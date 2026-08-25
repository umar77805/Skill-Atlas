import { runQuery } from './db.ts';
import type {
  SkillSummary,
  RoleSummary,
  PersonSummary,
  GraphNode,
  GraphEdge,
  GraphOverview,
  PrerequisiteRow,
  SkillGapRow,
  LearningPathRow,
  BridgeSkillRow,
  PersonDetail,
} from './types.ts';

// --- Basic listings -------------------------------------------------------

export async function listSkills(): Promise<SkillSummary[]> {
  return runQuery<SkillSummary>(
    `MATCH (s:Skill)
     OPTIONAL MATCH (s)-[:PREREQUISITE_OF]->(next:Skill)
     WITH s, count(next) AS unlocks
     RETURN s.name AS name, s.category AS category, unlocks
     ORDER BY s.category, s.name`
  );
}

export async function listRoles(): Promise<RoleSummary[]> {
  return runQuery<RoleSummary>(
    `MATCH (r:Role)
     OPTIONAL MATCH (r)-[:REQUIRES]->(s:Skill)
     RETURN r.title AS title, r.level AS level, count(s) AS skillCount
     ORDER BY r.title`
  );
}

export async function listPeople(): Promise<PersonSummary[]> {
  return runQuery<PersonSummary>(
    `MATCH (p:Person)
     OPTIONAL MATCH (p)-[:HAS_SKILL]->(s:Skill)
     RETURN p.name AS name, p.targetRole AS targetRole, count(s) AS skillCount
     ORDER BY p.name`
  );
}

// --- Graph data for the visual explorer -----------------------------------

interface GraphOverviewRow {
  nId: string;
  nLabels: string[];
  nProps: Record<string, unknown>;
  relId: string | null;
  relType: string | null;
  mId: string | null;
  mLabels: string[] | null;
  mProps: Record<string, unknown> | null;
}

export async function getGraphOverview(): Promise<GraphOverview> {
  // Nodes across all four labels plus the relationships between them, capped
  // so the visualisation stays legible. Used to render the force-directed graph.
  // Neo4j Node/Relationship objects (and their Integer ids) don't serialise
  // cleanly to JSON, so we flatten everything to plain objects here rather
  // than leaving that to the route handler.
  const rows = await runQuery<GraphOverviewRow>(
    `MATCH (n)
     WHERE n:Skill OR n:Course OR n:Role OR n:Person
     OPTIONAL MATCH (n)-[rel:PREREQUISITE_OF|TEACHES|REQUIRES|HAS_SKILL]->(m)
     RETURN
       elementId(n) AS nId, labels(n) AS nLabels, properties(n) AS nProps,
       elementId(rel) AS relId, type(rel) AS relType,
       elementId(m) AS mId, labels(m) AS mLabels, properties(m) AS mProps
     LIMIT 600`
  );

  const nodesById = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];

  for (const row of rows) {
    if (!nodesById.has(row.nId)) {
      nodesById.set(row.nId, { id: row.nId, label: row.nLabels[0], ...row.nProps });
    }
    if (row.relId) {
      if (!nodesById.has(row.mId as string)) {
        nodesById.set(row.mId as string, { id: row.mId as string, label: (row.mLabels as string[])[0], ...row.mProps });
      }
      edges.push({ id: row.relId, source: row.nId, target: row.mId as string, type: row.relType as string });
    }
  }

  return { nodes: Array.from(nodesById.values()), edges };
}

// --- Requirement 5.1: multi-hop traversal ----------------------------------
// Walks the PREREQUISITE_OF chain backwards from a target skill, arbitrary
// depth. In SQL this is a recursive CTE; here it's one clause.
export async function getPrerequisiteChain(skillName: string): Promise<PrerequisiteRow[]> {
  return runQuery<PrerequisiteRow>(
    `MATCH path = (root:Skill)-[:PREREQUISITE_OF*1..8]->(target:Skill {name: $skillName})
     WITH root, min(length(path)) AS depth
     RETURN root.name AS skill, root.category AS category, depth
     ORDER BY depth, skill`,
    { skillName }
  );
}

// --- Skill-gap analysis for a learner against a role ------------------------
export async function getSkillGap(personName: string, roleTitle: string): Promise<SkillGapRow[]> {
  return runQuery<SkillGapRow>(
    `MATCH (p:Person {name: $personName})
     OPTIONAL MATCH (p)-[:HAS_SKILL]->(known:Skill)
     WITH collect(known.name) AS knownNames
     MATCH (r:Role {title: $roleTitle})-[req:REQUIRES]->(s:Skill)
     WHERE NOT s.name IN knownNames
     OPTIONAL MATCH (c:Course)-[:TEACHES]->(s)
     RETURN s.name AS skill, s.category AS category, req.importance AS importance,
            collect(DISTINCT c.title) AS courses
     ORDER BY req.importance, s.name`,
    { personName, roleTitle }
  );
}

// --- Ordered learning path: missing skills ranked by how many other missing
// skills still block them (fewest-blockers first = learnable soonest). This
// walks the same variable-length PREREQUISITE_OF relationship as above, but
// composes it with the learner's current knowledge and the role's needs -
// a query that would require several recursive joins in a relational schema.
export async function getLearningPath(personName: string, roleTitle: string): Promise<LearningPathRow[]> {
  return runQuery<LearningPathRow>(
    `MATCH (p:Person {name: $personName})
     OPTIONAL MATCH (p)-[:HAS_SKILL]->(known:Skill)
     WITH collect(known.name) AS knownNames
     MATCH (r:Role {title: $roleTitle})-[:REQUIRES]->(target:Skill)
     WHERE NOT target.name IN knownNames
     OPTIONAL MATCH (blocker:Skill)-[:PREREQUISITE_OF*1..8]->(target)
     WHERE blocker <> target AND NOT blocker.name IN knownNames
     WITH target, count(DISTINCT blocker) AS blockedBy
     OPTIONAL MATCH (c:Course)-[:TEACHES]->(target)
     RETURN target.name AS skill, target.category AS category, blockedBy,
            collect(DISTINCT c.title) AS courses
     ORDER BY blockedBy ASC, target.name`,
    { personName, roleTitle }
  );
}

// --- Requirement 5.1: query a relational DB would find awkward -------------
// "Bridge skills": skills that sit upstream (at any depth) of skills required
// by many different roles, but are never *directly* required by any role
// themselves. These are the hidden foundational skills worth learning early.
// In SQL this needs a recursive closure table plus an anti-join plus a
// having-count aggregate - Cypher expresses it as one pattern.
export async function getBridgeSkills(minRoles = 3): Promise<BridgeSkillRow[]> {
  return runQuery<BridgeSkillRow>(
    `MATCH (:Role)-[:REQUIRES]->(directSkill:Skill)
     WITH collect(DISTINCT directSkill.name) AS directlyRequiredNames
     MATCH (s:Skill)-[:PREREQUISITE_OF*1..8]->(needed:Skill)<-[:REQUIRES]-(r:Role)
     WHERE NOT s.name IN directlyRequiredNames
     WITH s, count(DISTINCT r) AS rolesUnlocked, collect(DISTINCT r.title) AS roleTitles
     WHERE rolesUnlocked >= $minRoles
     RETURN s.name AS skill, s.category AS category, rolesUnlocked, roleTitles
     ORDER BY rolesUnlocked DESC, s.name`,
    { minRoles: neo4jInt(minRoles) }
  );
}

// Small helper: neo4j-driver wants integers as JS numbers is fine for params
// in recent driver versions, but keep this explicit for clarity/safety.
function neo4jInt(n: number | string): number {
  return typeof n === 'number' ? n : parseInt(n, 10);
}

export async function getPersonDetail(personName: string): Promise<PersonDetail | null> {
  const [profile] = await runQuery<PersonDetail>(
    `MATCH (p:Person {name: $personName})
     OPTIONAL MATCH (p)-[hs:HAS_SKILL]->(s:Skill)
     WITH p, collect(DISTINCT {name: s.name, category: s.category, level: hs.level}) AS skills
     OPTIONAL MATCH (p)-[:COMPLETED]->(c:Course)
     RETURN p.name AS name, p.targetRole AS targetRole, skills,
            collect(DISTINCT c.title) AS completed`,
    { personName }
  );
  return profile || null;
}
