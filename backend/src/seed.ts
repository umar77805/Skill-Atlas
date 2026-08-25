// Seeds CognoDB with a realistic career/skill graph:
//   Skill  --PREREQUISITE_OF-->  Skill
//   Course --TEACHES-->          Skill
//   Role   --REQUIRES-->         Skill   (importance: core | helpful)
//   Person --HAS_SKILL-->        Skill   (level: 1-5)
//   Person --COMPLETED-->        Course
//
// Run with: npm run seed  (reads connection details from backend/.env)

import { driver, verifyConnectivity, closeDriver } from './db.ts';

interface Skill {
  name: string;
  category: string;
}

interface Course {
  title: string;
  provider: string;
  hours: number;
  teaches: string[];
}

interface Role {
  title: string;
  level: string;
  requires: [string, 'core' | 'helpful'][];
}

interface Person {
  name: string;
  targetRole: string;
  hasSkills: [string, number][];
  completed: string[];
}

const skills: Skill[] = [
  { name: 'HTML', category: 'Frontend' },
  { name: 'CSS', category: 'Frontend' },
  { name: 'JavaScript', category: 'Frontend' },
  { name: 'TypeScript', category: 'Frontend' },
  { name: 'React', category: 'Frontend' },
  { name: 'State Management', category: 'Frontend' },
  { name: 'Accessibility', category: 'Frontend' },
  { name: 'Testing', category: 'Engineering' },
  { name: 'Git', category: 'Engineering' },
  { name: 'Node.js', category: 'Backend' },
  { name: 'REST APIs', category: 'Backend' },
  { name: 'GraphQL', category: 'Backend' },
  { name: 'Databases', category: 'Backend' },
  { name: 'SQL', category: 'Backend' },
  { name: 'System Design', category: 'Engineering' },
  { name: 'Linux', category: 'Infrastructure' },
  { name: 'Docker', category: 'Infrastructure' },
  { name: 'Kubernetes', category: 'Infrastructure' },
  { name: 'CI/CD', category: 'Infrastructure' },
  { name: 'Cloud Fundamentals', category: 'Infrastructure' },
  { name: 'Python', category: 'Data' },
  { name: 'Statistics', category: 'Data' },
  { name: 'Data Visualization', category: 'Data' },
  { name: 'Pandas', category: 'Data' },
  { name: 'NumPy', category: 'Data' },
  { name: 'Machine Learning Basics', category: 'Data' },
  { name: 'Deep Learning', category: 'Data' },
  { name: 'NLP', category: 'Data' },
  { name: 'UX Fundamentals', category: 'Product' },
  { name: 'Wireframing', category: 'Product' },
  { name: 'Agile', category: 'Product' },
];

// a -> b means "a is a prerequisite of b" (learn a before b)
const prerequisites: [string, string][] = [
  ['HTML', 'CSS'],
  ['CSS', 'JavaScript'],
  ['JavaScript', 'TypeScript'],
  ['JavaScript', 'React'],
  ['TypeScript', 'React'],
  ['React', 'State Management'],
  ['UX Fundamentals', 'Accessibility'],
  ['CSS', 'Accessibility'],
  ['JavaScript', 'Testing'],
  ['JavaScript', 'Node.js'],
  ['Node.js', 'REST APIs'],
  ['REST APIs', 'GraphQL'],
  ['Databases', 'SQL'],
  ['SQL', 'System Design'],
  ['REST APIs', 'System Design'],
  ['Linux', 'Docker'],
  ['Docker', 'Kubernetes'],
  ['Docker', 'CI/CD'],
  ['Git', 'CI/CD'],
  ['Cloud Fundamentals', 'Kubernetes'],
  ['Python', 'Pandas'],
  ['Python', 'NumPy'],
  ['Statistics', 'Machine Learning Basics'],
  ['Python', 'Machine Learning Basics'],
  ['NumPy', 'Machine Learning Basics'],
  ['Pandas', 'Data Visualization'],
  ['Machine Learning Basics', 'Deep Learning'],
  ['Machine Learning Basics', 'NLP'],
  ['UX Fundamentals', 'Wireframing'],
];

const courses: Course[] = [
  { title: 'HTML & CSS Foundations', provider: 'Atlas Academy', hours: 8, teaches: ['HTML', 'CSS'] },
  { title: 'JavaScript from Scratch', provider: 'Atlas Academy', hours: 20, teaches: ['JavaScript'] },
  { title: 'TypeScript in Practice', provider: 'CodeForge', hours: 10, teaches: ['TypeScript'] },
  { title: 'React Essentials', provider: 'CodeForge', hours: 16, teaches: ['React'] },
  { title: 'Managing State at Scale', provider: 'CodeForge', hours: 6, teaches: ['State Management'] },
  { title: 'Inclusive Web Design', provider: 'Atlas Academy', hours: 5, teaches: ['Accessibility'] },
  { title: 'Testing JavaScript Applications', provider: 'CodeForge', hours: 9, teaches: ['Testing'] },
  { title: 'Git & Collaborative Workflows', provider: 'Atlas Academy', hours: 3, teaches: ['Git'] },
  { title: 'Server-Side Node.js', provider: 'BackendLab', hours: 14, teaches: ['Node.js'] },
  { title: 'Designing REST APIs', provider: 'BackendLab', hours: 8, teaches: ['REST APIs'] },
  { title: 'GraphQL in Depth', provider: 'BackendLab', hours: 7, teaches: ['GraphQL'] },
  { title: 'Relational Databases 101', provider: 'BackendLab', hours: 6, teaches: ['Databases'] },
  { title: 'SQL for Engineers', provider: 'BackendLab', hours: 10, teaches: ['SQL'] },
  { title: 'System Design Interview Prep', provider: 'ScaleSchool', hours: 12, teaches: ['System Design'] },
  { title: 'Linux Command Line', provider: 'OpsWorks', hours: 6, teaches: ['Linux'] },
  { title: 'Docker for Developers', provider: 'OpsWorks', hours: 8, teaches: ['Docker'] },
  { title: 'Kubernetes Fundamentals', provider: 'OpsWorks', hours: 12, teaches: ['Kubernetes'] },
  { title: 'CI/CD Pipelines', provider: 'OpsWorks', hours: 5, teaches: ['CI/CD'] },
  { title: 'Cloud Fundamentals (AWS)', provider: 'OpsWorks', hours: 10, teaches: ['Cloud Fundamentals'] },
  { title: 'Python for Everyone', provider: 'DataForge', hours: 15, teaches: ['Python'] },
  { title: 'Statistics for Data Science', provider: 'DataForge', hours: 12, teaches: ['Statistics'] },
  { title: 'Data Visualization with Python', provider: 'DataForge', hours: 6, teaches: ['Data Visualization'] },
  { title: 'Pandas Deep Dive', provider: 'DataForge', hours: 8, teaches: ['Pandas'] },
  { title: 'NumPy Essentials', provider: 'DataForge', hours: 4, teaches: ['NumPy'] },
  { title: 'Intro to Machine Learning', provider: 'DataForge', hours: 18, teaches: ['Machine Learning Basics'] },
  { title: 'Deep Learning Specialization', provider: 'DataForge', hours: 24, teaches: ['Deep Learning'] },
  { title: 'Natural Language Processing', provider: 'DataForge', hours: 16, teaches: ['NLP'] },
  { title: 'UX Fundamentals', provider: 'DesignLoop', hours: 6, teaches: ['UX Fundamentals'] },
  { title: 'Wireframing & Prototyping', provider: 'DesignLoop', hours: 5, teaches: ['Wireframing'] },
  { title: 'Agile for Teams', provider: 'DesignLoop', hours: 4, teaches: ['Agile'] },
];

const roles: Role[] = [
  {
    title: 'Junior Frontend Engineer',
    level: 'Junior',
    requires: [
      ['HTML', 'core'], ['CSS', 'core'], ['JavaScript', 'core'], ['Git', 'core'], ['React', 'helpful'],
    ],
  },
  {
    title: 'Senior Frontend Engineer',
    level: 'Senior',
    requires: [
      ['HTML', 'core'], ['CSS', 'core'], ['JavaScript', 'core'], ['TypeScript', 'core'],
      ['React', 'core'], ['State Management', 'core'], ['Testing', 'core'],
      ['Accessibility', 'core'], ['System Design', 'helpful'],
    ],
  },
  {
    title: 'Backend Engineer',
    level: 'Mid',
    requires: [
      ['JavaScript', 'core'], ['Node.js', 'core'], ['REST APIs', 'core'], ['Databases', 'core'],
      ['SQL', 'core'], ['Git', 'core'], ['System Design', 'helpful'], ['Testing', 'helpful'],
    ],
  },
  {
    title: 'Full-Stack Engineer',
    level: 'Mid',
    requires: [
      ['JavaScript', 'core'], ['React', 'core'], ['Node.js', 'core'], ['REST APIs', 'core'],
      ['SQL', 'core'], ['Git', 'core'], ['Testing', 'helpful'], ['System Design', 'helpful'],
    ],
  },
  {
    title: 'DevOps Engineer',
    level: 'Mid',
    requires: [
      ['Linux', 'core'], ['Docker', 'core'], ['Kubernetes', 'core'], ['CI/CD', 'core'],
      ['Cloud Fundamentals', 'core'], ['Git', 'core'], ['System Design', 'helpful'],
    ],
  },
  {
    title: 'Data Analyst',
    level: 'Junior',
    requires: [
      ['SQL', 'core'], ['Statistics', 'core'], ['Data Visualization', 'core'], ['Python', 'helpful'],
    ],
  },
  {
    title: 'Data Scientist',
    level: 'Mid',
    requires: [
      ['Python', 'core'], ['Statistics', 'core'], ['Pandas', 'core'], ['NumPy', 'core'],
      ['Machine Learning Basics', 'core'], ['SQL', 'core'], ['Data Visualization', 'helpful'],
    ],
  },
  {
    title: 'ML Engineer',
    level: 'Senior',
    requires: [
      ['Python', 'core'], ['Machine Learning Basics', 'core'], ['Deep Learning', 'core'],
      ['Docker', 'core'], ['Cloud Fundamentals', 'core'], ['System Design', 'helpful'], ['NumPy', 'core'],
    ],
  },
  {
    title: 'Product Manager',
    level: 'Mid',
    requires: [
      ['Agile', 'core'], ['UX Fundamentals', 'core'], ['Wireframing', 'core'], ['Data Visualization', 'helpful'],
    ],
  },
  {
    title: 'Engineering Manager',
    level: 'Senior',
    requires: [
      ['System Design', 'core'], ['Agile', 'core'], ['Git', 'core'], ['Testing', 'helpful'],
    ],
  },
];

// Demo learners so the app has something to explore immediately after seeding.
const people: Person[] = [
  {
    name: 'Alex Rivera',
    targetRole: 'Senior Frontend Engineer',
    hasSkills: [
      ['HTML', 5], ['CSS', 4], ['JavaScript', 4], ['Git', 3], ['React', 3], ['Testing', 2],
    ],
    completed: ['HTML & CSS Foundations', 'JavaScript from Scratch', 'React Essentials'],
  },
  {
    name: 'Priya Nair',
    targetRole: 'Data Scientist',
    hasSkills: [
      ['Python', 4], ['SQL', 3], ['Statistics', 2], ['Git', 3],
    ],
    completed: ['Python for Everyone', 'SQL for Engineers'],
  },
];

async function seed() {
  const ok = await verifyConnectivity();
  if (!ok) {
    console.error('Aborting seed: cannot reach CognoDB. Check backend/.env.');
    process.exitCode = 1;
    return;
  }

  const session = driver.session();
  try {
    console.log('Clearing existing graph...');
    await session.run('MATCH (n) DETACH DELETE n');

    console.log('Creating constraints...');
    await session.run('CREATE CONSTRAINT skill_name IF NOT EXISTS FOR (s:Skill) REQUIRE s.name IS UNIQUE');
    await session.run('CREATE CONSTRAINT course_title IF NOT EXISTS FOR (c:Course) REQUIRE c.title IS UNIQUE');
    await session.run('CREATE CONSTRAINT role_title IF NOT EXISTS FOR (r:Role) REQUIRE r.title IS UNIQUE');
    await session.run('CREATE CONSTRAINT person_name IF NOT EXISTS FOR (p:Person) REQUIRE p.name IS UNIQUE');

    console.log(`Loading ${skills.length} skills...`);
    await session.run(
      `UNWIND $skills AS row
       CREATE (s:Skill {name: row.name, category: row.category})`,
      { skills }
    );

    console.log(`Loading ${prerequisites.length} prerequisite edges...`);
    await session.run(
      `UNWIND $rows AS row
       MATCH (a:Skill {name: row[0]}), (b:Skill {name: row[1]})
       CREATE (a)-[:PREREQUISITE_OF]->(b)`,
      { rows: prerequisites }
    );

    console.log(`Loading ${courses.length} courses...`);
    for (const course of courses) {
      await session.run(
        `CREATE (c:Course {title: $title, provider: $provider, hours: $hours})
         WITH c
         UNWIND $teaches AS skillName
         MATCH (s:Skill {name: skillName})
         CREATE (c)-[:TEACHES]->(s)`,
        course
      );
    }

    console.log(`Loading ${roles.length} roles...`);
    for (const role of roles) {
      await session.run(
        `CREATE (r:Role {title: $title, level: $level})
         WITH r
         UNWIND $requires AS req
         MATCH (s:Skill {name: req[0]})
         CREATE (r)-[:REQUIRES {importance: req[1]}]->(s)`,
        role
      );
    }

    console.log(`Loading ${people.length} demo learners...`);
    for (const person of people) {
      await session.run(
        `CREATE (p:Person {name: $name, targetRole: $targetRole})
         WITH p
         UNWIND $hasSkills AS hs
         MATCH (s:Skill {name: hs[0]})
         CREATE (p)-[:HAS_SKILL {level: hs[1]}]->(s)`,
        person
      );
      await session.run(
        `MATCH (p:Person {name: $name})
         UNWIND $completed AS courseTitle
         MATCH (c:Course {title: courseTitle})
         CREATE (p)-[:COMPLETED]->(c)`,
        person
      );
    }

    console.log('Seed complete.');
  } finally {
    await session.close();
    await closeDriver();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exitCode = 1;
});
