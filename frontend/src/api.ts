import type {
  HealthStatus,
  SkillSummary,
  PrerequisiteRow,
  RoleSummary,
  SkillGapRow,
  LearningPathRow,
  PersonSummary,
  PersonDetail,
  BridgeSkillRow,
  GraphOverview,
} from './types.ts';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export class ApiError extends Error {
  status?: number;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new ApiError(body.detail || body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function skillsQuery(skillNames: string[]): string {
  return ['mode=skills', ...skillNames.map((s) => `skills=${encodeURIComponent(s)}`)].join('&');
}

export const api = {
  health: (): Promise<HealthStatus> => get('/api/health'),
  skills: (): Promise<SkillSummary[]> => get('/api/skills'),
  prerequisites: (skillName: string): Promise<PrerequisiteRow[]> =>
    get(`/api/skills/${encodeURIComponent(skillName)}/prerequisites`),
  roles: (): Promise<RoleSummary[]> => get('/api/roles'),
  gap: (roleTitle: string, personName: string): Promise<SkillGapRow[]> =>
    get(`/api/roles/${encodeURIComponent(roleTitle)}/gap?person=${encodeURIComponent(personName)}`),
  path: (roleTitle: string, personName: string): Promise<LearningPathRow[]> =>
    get(`/api/roles/${encodeURIComponent(roleTitle)}/path?person=${encodeURIComponent(personName)}`),
  gapForSkills: (roleTitle: string, skillNames: string[]): Promise<SkillGapRow[]> =>
    get(`/api/roles/${encodeURIComponent(roleTitle)}/gap?${skillsQuery(skillNames)}`),
  pathForSkills: (roleTitle: string, skillNames: string[]): Promise<LearningPathRow[]> =>
    get(`/api/roles/${encodeURIComponent(roleTitle)}/path?${skillsQuery(skillNames)}`),
  people: (): Promise<PersonSummary[]> => get('/api/people'),
  person: (name: string): Promise<PersonDetail> => get(`/api/people/${encodeURIComponent(name)}`),
  bridgeSkills: (minRoles = 3): Promise<BridgeSkillRow[]> => get(`/api/insights/bridge-skills?minRoles=${minRoles}`),
  graph: (): Promise<GraphOverview> => get('/api/graph'),
};
