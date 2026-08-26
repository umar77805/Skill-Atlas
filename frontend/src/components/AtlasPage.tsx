import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.ts';
import GraphCanvas from './GraphCanvas.tsx';
import TreeDiagram, { type TreeNodeData } from './TreeDiagram.tsx';
import { LoadingBlock, ErrorBlock, EmptyBlock } from './StateBlock.tsx';
import DevInfo from './DevInfo.tsx';
import type { GraphOverview, SkillSummary, PrerequisiteRow } from '../types.ts';

const ALL_LABELS = ['Skill', 'Role', 'Course'];

export default function AtlasPage() {
  const [graph, setGraph] = useState<GraphOverview | null>(null);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [visibleLabels, setVisibleLabels] = useState<Set<string>>(new Set(['Skill', 'Role']));

  const [selectedSkill, setSelectedSkill] = useState('');
  const [chain, setChain] = useState<PrerequisiteRow[] | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);

  const loadGraph = () => {
    setGraph(null);
    setGraphError(null);
    Promise.all([api.graph(), api.skills()])
      .then(([g, s]) => { setGraph(g); setSkills(s); })
      .catch((err) => setGraphError(err.message));
  };

  useEffect(loadGraph, []);

  const nameToId = useMemo(() => {
    const map = new Map<string, string>();
    if (!graph) return map;
    for (const n of graph.nodes) {
      if (n.label === 'Skill' && n.name) map.set(n.name, n.id);
    }
    return map;
  }, [graph]);

  const loadChain = (skillName: string) => {
    setSelectedSkill(skillName);
    setChain(null);
    setChainError(null);
    if (!skillName) return;
    setChainLoading(true);
    api.prerequisites(skillName)
      .then(setChain)
      .catch((err) => setChainError(err.message))
      .finally(() => setChainLoading(false));
  };

  const skillTree = useMemo<TreeNodeData | null>(() => {
    if (!chain || !graph || !selectedSkill) return null;

    const chainNames = new Set(chain.map((r) => r.skill));
    const categoryByName = new Map(chain.map((r) => [r.skill, r.category]));
    const rootSummary = skills.find((s) => s.name === selectedSkill);
    if (rootSummary) categoryByName.set(selectedSkill, rootSummary.category);

    const idToName = new Map<string, string>();
    for (const [name, id] of nameToId) idToName.set(id, name);

    // Direct PREREQUISITE_OF edges (prerequisite -> unlocked skill), restricted
    // to skills that are actually part of this chain, so the tree mirrors the
    // real graph structure rather than just a flat depth ranking.
    const directPrereqsOf = new Map<string, string[]>();
    for (const e of graph.edges) {
      if (e.type !== 'PREREQUISITE_OF') continue;
      const sourceName = idToName.get(e.source);
      const targetName = idToName.get(e.target);
      if (!sourceName || !targetName) continue;
      const targetInTree = targetName === selectedSkill || chainNames.has(targetName);
      const sourceInTree = sourceName === selectedSkill || chainNames.has(sourceName);
      if (!targetInTree || !sourceInTree) continue;
      const arr = directPrereqsOf.get(targetName) ?? [];
      arr.push(sourceName);
      directPrereqsOf.set(targetName, arr);
    }

    const build = (name: string, ancestry: Set<string>): TreeNodeData => {
      const nextAncestry = new Set(ancestry).add(name);
      const kids = (directPrereqsOf.get(name) ?? [])
        .filter((k) => !ancestry.has(k)) // guard against cycles
        .sort((a, b) => a.localeCompare(b));
      return {
        name,
        category: categoryByName.get(name) ?? '',
        children: kids.map((k) => build(k, nextAncestry)),
      };
    };

    return build(selectedSkill, new Set());
  }, [chain, graph, selectedSkill, nameToId, skills]);

  const highlighted = useMemo(() => {
    const set = new Set<string>();
    const selectedId = nameToId.get(selectedSkill);
    if (selectedId) set.add(selectedId);
    if (chain) for (const row of chain) {
      const id = nameToId.get(row.skill);
      if (id) set.add(id);
    }
    return set;
  }, [chain, selectedSkill, nameToId]);

  const toggleLabel = (label: string) => {
    setVisibleLabels((prev) => {
      const next = new Set(prev);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });
  };

  return (
    <div>
      <div className="page-header">
        <div className="eyebrow">01 · Atlas</div>
        <h1 className="page-title">The skill graph</h1>
        <p className="page-lede">
          Every circle is a skill; amber diamonds are roles. Pick a skill on the right to trace every
          prerequisite that leads to it, at any depth.
        </p>
      </div>

      <div className="grid-2">
        <div className="panel graph-panel">
          {graphError && <ErrorBlock message={graphError} onRetry={loadGraph} />}
          {!graphError && !graph && <LoadingBlock label="Charting the atlas…" />}
          {graph && (
            <GraphCanvas
              nodes={graph.nodes}
              edges={graph.edges}
              highlighted={highlighted}
              selectedId={nameToId.get(selectedSkill)}
              visibleLabels={visibleLabels}
              onNodeClick={(n) => n.label === 'Skill' && n.name && loadChain(n.name === selectedSkill ? '' : n.name)}
            />
          )}
          <div className="filter-toggles">
            {ALL_LABELS.map((label) => (
              <button
                key={label}
                className={`toggle-chip${visibleLabels.has(label) ? ' on' : ''}`}
                onClick={() => toggleLabel(label)}
              >
                {label}s
              </button>
            ))}
          </div>
          <div className="legend">
            <div className="legend-item"><span className="legend-swatch" style={{ background: 'var(--violet)' }} /> Selected / on route</div>
            <div className="legend-item"><span className="legend-swatch" style={{ background: 'var(--panel-raised)', border: '1.5px solid var(--teal)' }} /> Skill</div>
            <div className="legend-item"><span className="legend-swatch" style={{ background: 'var(--amber)' }} /> Role</div>
          </div>
        </div>

        <div className="panel">
          <div className="section-title">Prerequisite chain</div>
          <div className="field-row">
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="skill-select">Target skill</label>
              <select id="skill-select" value={selectedSkill} onChange={(e) => loadChain(e.target.value)}>
                <option value="">Choose a skill…</option>
                {skills.map((s) => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {!selectedSkill && (
            <EmptyBlock title="No skill selected" hint="Pick a skill from the dropdown or click a node in the atlas." />
          )}
          {chainLoading && <LoadingBlock label="Walking the prerequisite chain…" />}
          {chainError && <ErrorBlock message={chainError} onRetry={() => loadChain(selectedSkill)} />}
          {chain && chain.length === 0 && (
            <EmptyBlock title="No prerequisites" hint={`${selectedSkill} has no upstream skills — it's a starting point.`} />
          )}
          {chain && chain.length > 0 && skillTree && (
            <TreeDiagram key={selectedSkill} root={skillTree} />
          )}

          {chain && chain.length > 0 && (
            <DevInfo>
              <div className="section-title">Cypher behind this</div>
              <div className="query-box">{`MATCH path = (root:Skill)-[:PREREQUISITE_OF*1..8]->(target:Skill {name: $skillName})
WITH root, min(length(path)) AS depth
RETURN root.name AS skill, depth
ORDER BY depth`}</div>
            </DevInfo>
          )}
        </div>
      </div>
    </div>
  );
}
