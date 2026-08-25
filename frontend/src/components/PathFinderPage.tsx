import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import { LoadingBlock, ErrorBlock, EmptyBlock } from './StateBlock.tsx';
import type { PersonSummary, RoleSummary, SkillGapRow, LearningPathRow } from '../types.ts';

export default function PathFinderPage() {
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [person, setPerson] = useState('');
  const [role, setRole] = useState('');

  const [gap, setGap] = useState<SkillGapRow[] | null>(null);
  const [path, setPath] = useState<LearningPathRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLists = () => {
    setListError(null);
    Promise.all([api.people(), api.roles()])
      .then(([p, r]) => {
        setPeople(p);
        setRoles(r);
        if (p[0]) setPerson(p[0].name);
        if (p[0]?.targetRole) setRole(p[0].targetRole);
        else if (r[0]) setRole(r[0].title);
      })
      .catch((err) => setListError(err.message));
  };

  useEffect(loadLists, []);

  const runQuery = (p: string = person, r: string = role) => {
    if (!p || !r) return;
    setLoading(true);
    setError(null);
    Promise.all([api.gap(r, p), api.path(r, p)])
      .then(([g, path_]) => { setGap(g); setPath(path_); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (person && role) runQuery(person, role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person, role]);

  return (
    <div>
      <div className="page-header">
        <div className="eyebrow">02 · Path Finder</div>
        <h1 className="page-title">Close the gap to a role</h1>
        <p className="page-lede">
          Compare a learner's current skills against a target role, then get the missing skills ordered by how many
          other missing prerequisites still block each one — the soonest-learnable skills float to the top.
        </p>
      </div>

      {listError && <ErrorBlock message={listError} onRetry={loadLists} />}

      {!listError && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="field-row" style={{ marginBottom: 0 }}>
            <div className="field">
              <label htmlFor="person-select">Learner</label>
              <select id="person-select" value={person} onChange={(e) => setPerson(e.target.value)}>
                {people.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="role-select">Target role</label>
              <select id="role-select" value={role} onChange={(e) => setRole(e.target.value)}>
                {roles.map((r) => <option key={r.title} value={r.title}>{r.title}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {loading && <LoadingBlock label="Comparing skills against the role…" />}
      {error && <ErrorBlock message={error} onRetry={() => runQuery()} />}

      {!loading && !error && gap && (
        <div className="grid-2">
          <div className="panel">
            <div className="section-title">Missing skills, learning order</div>
            {path && path.length === 0 && (
              <EmptyBlock title="No gap" hint={`${person} already has every skill ${role} requires. 🎉`} />
            )}
            {path && path.length > 0 && (
              <ul className="skill-list">
                {path.map((row, i) => (
                  <li className="skill-row" key={row.skill}>
                    <div>
                      <div className="name">{i + 1}. {row.skill}</div>
                      {row.courses.length > 0 && (
                        <div className="courses">via {row.courses.join(', ')}</div>
                      )}
                    </div>
                    <span className="tag">{row.blockedBy === 0 ? 'ready now' : `${row.blockedBy} blocking`}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panel">
            <div className="section-title">Requirement detail</div>
            {gap.length === 0 && <EmptyBlock title="Fully qualified" hint="No requirements missing." />}
            {gap.length > 0 && (
              <ul className="skill-list">
                {gap.map((row) => (
                  <li className="skill-row" key={row.skill}>
                    <div>
                      <div className="name">{row.skill}</div>
                      <div className="courses">{row.category}{row.courses.length > 0 ? ` · ${row.courses.join(', ')}` : ' · no course yet'}</div>
                    </div>
                    <span className={`tag${row.importance === 'core' ? ' core' : ''}`}>{row.importance}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
