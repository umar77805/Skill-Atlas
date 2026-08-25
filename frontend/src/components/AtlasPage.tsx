import { useEffect, useMemo, useState } from 'react';
import { api } from '../api.ts';
import GraphCanvas from './GraphCanvas.tsx';
import { LoadingBlock, ErrorBlock, EmptyBlock } from './StateBlock.tsx';
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
          prerequisite that leads to it, at any depth — a single Cypher traversal lights up the whole route.
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
              onNodeClick={(n) => n.label === 'Skill' && n.name && loadChain(n.name)}
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
            <div className="legend-item"><span className="legend-swatch" style={{ background: 'var(--amber)' }} /> Selected / on route</div>
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
          {chain && chain.length > 0 && (
            <ul className="skill-list">
              {chain.map((row) => (
                <li className="skill-row" key={row.skill}>
                  <div>
                    <div className="name">{row.skill}</div>
                    <div className="courses">{row.category}</div>
                  </div>
                  <span className="depth-badge" title={`${row.depth} hop(s) away`}>{row.depth}</span>
                </li>
              ))}
            </ul>
          )}

          {chain && chain.length > 0 && (
            <>
              <div className="section-title" style={{ marginTop: 20 }}>Cypher behind this</div>
              <div className="query-box">{`MATCH path = (root:Skill)-[:PREREQUISITE_OF*1..8]->(target:Skill {name: $skillName})
WITH root, min(length(path)) AS depth
RETURN root.name AS skill, depth
ORDER BY depth`}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
