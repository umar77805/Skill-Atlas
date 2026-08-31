import { useEffect, useState } from 'react';
import { api } from '../api.ts';
import { LoadingBlock, ErrorBlock, EmptyBlock } from './StateBlock.tsx';
import DevInfo from './DevInfo.tsx';
import AddYourselfModal, { type SimulatedProfile } from './AddYourselfModal.tsx';
import InfoIcon from './InfoIcon.tsx';
import type { PersonSummary, RoleSummary, SkillGapRow, LearningPathRow } from '../types.ts';

const SIMULATED_VALUE = '__simulated__';

export default function PathFinderPage() {
  const [people, setPeople] = useState<PersonSummary[]>([]);
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);

  const [person, setPerson] = useState('');
  const [role, setRole] = useState('');

  const [simulatedProfile, setSimulatedProfile] = useState<SimulatedProfile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
    const useSimulated = p === SIMULATED_VALUE && simulatedProfile;
    const request = useSimulated
      ? Promise.all([api.gapForSkills(r, simulatedProfile.skills), api.pathForSkills(r, simulatedProfile.skills)])
      : Promise.all([api.gap(r, p), api.path(r, p)]);
    request
      .then(([g, path_]) => { setGap(g); setPath(path_); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (person && role) runQuery(person, role);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person, role, simulatedProfile]);

  const isSimulated = person === SIMULATED_VALUE && !!simulatedProfile;
  const displayName = isSimulated ? simulatedProfile!.name : person;

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
              <div className="field-inline-row">
                <select id="person-select" value={person} onChange={(e) => setPerson(e.target.value)}>
                  {people.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                  {simulatedProfile && <option value={SIMULATED_VALUE}>{simulatedProfile.name} (you)</option>}
                </select>
                <span
                  className="info-icon actionable"
                  role="button"
                  tabIndex={0}
                  aria-label={simulatedProfile ? 'Edit your simulated skill profile' : 'Add your own skills'}
                  data-tooltip={simulatedProfile ? 'Edit your simulated profile' : 'Add yourself and simulate your own skill gap'}
                  onClick={() => setModalOpen(true)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setModalOpen(true); }}
                >
                  +
                </span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="role-select">Target role</label>
              <select id="role-select" value={role} onChange={(e) => setRole(e.target.value)}>
                {roles.map((r) => <option key={r.title} value={r.title}>{r.title}</option>)}
              </select>
            </div>
          </div>
          <div className="demo-note">
            {isSimulated ? (
              <>
                <InfoIcon
                  ariaLabel="This is your own entered skill list for this session only — it is never saved to the database."
                  tooltip="Simulated profile — your own skill picks, session-only, never written to the database."
                />
                This is your own skill list, entered for this session only — nothing is saved to the database.
              </>
            ) : (
              <>
                <InfoIcon
                  ariaLabel="Learner is a demo profile: a fictional person seeded into the database with a fixed set of skills, used to demonstrate the skill-gap and learning-path queries."
                  tooltip="Demo profile — seeded with a fixed set of skills for demonstration, not a real user."
                />
                Learners are demo profiles seeded with a fixed set of skills for demonstration, not real users.
              </>
            )}
          </div>
        </div>
      )}

      {modalOpen && (
        <AddYourselfModal
          existingProfile={simulatedProfile}
          onClose={() => setModalOpen(false)}
          onSave={(profile) => { setSimulatedProfile(profile); setPerson(SIMULATED_VALUE); setModalOpen(false); }}
          onRemove={() => {
            setSimulatedProfile(null);
            setModalOpen(false);
            if (person === SIMULATED_VALUE) {
              setPerson(people[0]?.name ?? '');
              if (people[0]?.targetRole) setRole(people[0].targetRole);
            }
          }}
        />
      )}

      {loading && <LoadingBlock label="Comparing skills against the role…" />}
      {error && <ErrorBlock message={error} onRetry={() => runQuery()} />}

      {!loading && !error && gap && (
        <div className="grid-2">
          <div className="panel">
            <div className="section-title">Missing skills, learning order</div>
            {path && path.length === 0 && (
              <EmptyBlock title="No gap" hint={`${displayName} already has every skill ${role} requires. 🎉`} />
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

      {!loading && !error && gap && (
        <DevInfo>
          <div className="panel" style={{ marginTop: 20 }}>
            <div className="section-title">Why this needs a graph</div>
            <p className="page-lede" style={{ marginBottom: 16 }}>
              Missing skills come from one pattern match: everything the role requires that the learner doesn't
              already have, with matching courses collected in the same query. The learning order comes from a
              second traversal — for each missing skill, count how many other missing skills still sit upstream
              of it via the same variable-length prerequisite path, then sort by that count. That gives a
              learnable order without ever materialising a full topological sort.
            </p>
            <div className="section-title">Skill gap</div>
            <div className="query-box">{isSimulated ? `MATCH (r:Role {title: $roleTitle})-[req:REQUIRES]->(s:Skill)
WHERE NOT s.name IN $skillNames
OPTIONAL MATCH (c:Course)-[:TEACHES]->(s)
RETURN s.name AS skill, req.importance AS importance, collect(DISTINCT c.title) AS courses` : `MATCH (r:Role {title: $roleTitle})-[req:REQUIRES]->(s:Skill)
WHERE NOT EXISTS { MATCH (:Person {name: $personName})-[:HAS_SKILL]->(s) }
OPTIONAL MATCH (c:Course)-[:TEACHES]->(s)
RETURN s.name AS skill, req.importance AS importance, collect(DISTINCT c.title) AS courses`}</div>
            <div className="section-title" style={{ marginTop: 16 }}>Ordered learning path</div>
            <div className="query-box">{isSimulated ? `MATCH (r:Role {title: $roleTitle})-[:REQUIRES]->(target:Skill)
WHERE NOT target.name IN $skillNames
OPTIONAL MATCH (blocker:Skill)-[:PREREQUISITE_OF*1..8]->(target)
WHERE NOT blocker.name IN $skillNames
WITH target, count(DISTINCT blocker) AS blockedBy
RETURN target.name AS skill, blockedBy ORDER BY blockedBy ASC` : `MATCH (r:Role {title: $roleTitle})-[:REQUIRES]->(target:Skill)
WHERE NOT EXISTS { MATCH (:Person {name: $personName})-[:HAS_SKILL]->(target) }
OPTIONAL MATCH (blocker:Skill)-[:PREREQUISITE_OF*1..8]->(target)
WHERE NOT EXISTS { MATCH (:Person {name: $personName})-[:HAS_SKILL]->(blocker) }
WITH target, count(DISTINCT blocker) AS blockedBy
RETURN target.name AS skill, blockedBy ORDER BY blockedBy ASC`}</div>
          </div>
        </DevInfo>
      )}
    </div>
  );
}
