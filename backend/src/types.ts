export interface SkillSummary {
  name: string;
  category: string;
  unlocks: number;
}

export interface RoleSummary {
  title: string;
  level: string;
  skillCount: number;
}

export interface PersonSummary {
  name: string;
  targetRole: string;
  skillCount: number;
}

export interface GraphNode {
  id: string;
  label: string;
  [key: string]: unknown;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export interface GraphOverview {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface PrerequisiteRow {
  skill: string;
  category: string;
  depth: number;
}

export interface SkillGapRow {
  skill: string;
  category: string;
  importance: 'core' | 'helpful';
  courses: string[];
}

export interface LearningPathRow {
  skill: string;
  category: string;
  blockedBy: number;
  courses: string[];
}

export interface BridgeSkillRow {
  skill: string;
  category: string;
  rolesUnlocked: number;
  roleTitles: string[];
}

export interface PersonDetail {
  name: string;
  targetRole: string;
  skills: { name: string; category: string; level: number }[];
  completed: string[];
}
