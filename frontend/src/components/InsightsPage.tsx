import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import { LoadingBlock, ErrorBlock, EmptyBlock } from './StateBlock.tsx';
import DevInfo from './DevInfo.tsx';
import { useDevMode } from '../DevModeContext.tsx';
import type { BridgeSkillRow } from '../types.ts';

export default function InsightsPage() {
  const { devMode } = useDevMode();
  const [minRoles, setMinRoles] = useState(3);
  const [rows, setRows] = useState<BridgeSkillRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    api.bridgeSkills(minRoles)
      .then(setRows)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [minRoles]);

  return (
    <div>
      <div className="page-header">
        <div className="eyebrow">03 · Insights</div>
        <h1 className="page-title">Bridge skills</h1>
        <p className="page-lede">
          Skills that no role lists directly, but that sit upstream of skills required by several roles at once —
          the hidden foundations worth learning early because they quietly unlock the most doors.
        </p>
      </div>

      <div className="panel" style={{ marginBottom: 20 }}>
        <div className="field-row" style={{ marginBottom: 0 }}>
          <div className="field">
            <label htmlFor="min-roles">Unlocks at least</label>
            <select id="min-roles" value={minRoles} onChange={(e) => setMinRoles(Number(e.target.value))}>
              <option value={2}>2 roles</option>
              <option value={3}>3 roles</option>
              <option value={4}>4 roles</option>
            </select>
          </div>
        </div>
      </div>

      <div className={devMode ? 'grid-2' : undefined}>
        <div className="panel">
          <div className="section-title">Results</div>
          {loading && <LoadingBlock label="Scanning role requirements…" />}
          {error && <ErrorBlock message={error} onRetry={load} />}
          {rows && rows.length === 0 && (
            <EmptyBlock title="No bridge skills at this threshold" hint="Try lowering the minimum roles unlocked." />
          )}
          {rows && rows.length > 0 && (
            <ul className="skill-list">
              {rows.map((row) => (
                <li className="skill-row" key={row.skill}>
                  <div>
                    <div className="name">{row.skill}</div>
                    <div className="courses">{row.category} · unlocks {row.roleTitles.join(', ')}</div>
                  </div>
                  <span className="tag core">{row.rolesUnlocked} roles</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DevInfo>
          <div className="panel">
            <div className="section-title">Why this needs a graph</div>
            <p className="page-lede" style={{ marginBottom: 16 }}>
              This asks for skills reachable through an unbounded chain of prerequisites, filtered by an anti-join
              against direct requirements, then grouped with a having-count. In SQL that's a recursive CTE for the
              closure, a LEFT JOIN / IS NULL for the anti-join, and a GROUP BY HAVING on top — three separate
              techniques stitched together. Cypher expresses the whole thing as one pattern match.
            </p>
            <div className="section-title">Cypher</div>
            <div className="query-box">{`MATCH (s:Skill)-[:PREREQUISITE_OF*1..8]->(needed:Skill)
      <-[:REQUIRES]-(r:Role)
WHERE NOT EXISTS { MATCH (:Role)-[:REQUIRES]->(s) }
WITH s, count(DISTINCT r) AS rolesUnlocked
WHERE rolesUnlocked >= $minRoles
RETURN s.name, rolesUnlocked
ORDER BY rolesUnlocked DESC`}</div>
          </div>
        </DevInfo>
      </div>
    </div>
  );
}
