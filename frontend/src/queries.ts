import { queryOptions } from '@tanstack/react-query';
import { api } from './api.ts';

export type LearnerKey =
  | { kind: 'person'; person: string }
  | { kind: 'simulated'; skills: string[] };

export const healthOptions = queryOptions({
  queryKey: ['health'] as const,
  queryFn: api.health,
});

export const skillsOptions = queryOptions({
  queryKey: ['skills'] as const,
  queryFn: api.skills,
});

export const graphOptions = queryOptions({
  queryKey: ['graph'] as const,
  queryFn: api.graph,
});

export const rolesOptions = queryOptions({
  queryKey: ['roles'] as const,
  queryFn: api.roles,
});

export const peopleOptions = queryOptions({
  queryKey: ['people'] as const,
  queryFn: api.people,
});

export function prerequisitesOptions(skillName: string) {
  return queryOptions({
    queryKey: ['prerequisites', skillName] as const,
    queryFn: () => api.prerequisites(skillName),
    enabled: !!skillName,
  });
}

export function bridgeSkillsOptions(minRoles: number) {
  return queryOptions({
    queryKey: ['bridgeSkills', minRoles] as const,
    queryFn: () => api.bridgeSkills(minRoles),
  });
}

export function roleGapOptions(role: string, learner: LearnerKey | null) {
  return queryOptions({
    queryKey: ['roleGap', role, learner] as const,
    queryFn: () =>
      learner!.kind === 'simulated'
        ? api.gapForSkills(role, learner!.skills)
        : api.gap(role, learner!.person),
    enabled: !!role && !!learner,
  });
}

export function rolePathOptions(role: string, learner: LearnerKey | null) {
  return queryOptions({
    queryKey: ['rolePath', role, learner] as const,
    queryFn: () =>
      learner!.kind === 'simulated'
        ? api.pathForSkills(role, learner!.skills)
        : api.path(role, learner!.person),
    enabled: !!role && !!learner,
  });
}
