import express, { type Request, type Response } from 'express';
import cors from 'cors';
import 'dotenv/config';
import { verifyConnectivity, isConnected } from './db.ts';
import * as q from './queries.ts';

const app = express();
const PORT = process.env.PORT || 4000;
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
  : '*';

app.use(cors({ origin: corsOrigin }));
app.use(express.json());

// Every request checks the last-known DB health so we return a clean 503
// instead of an unhandled driver exception when CognoDB is unreachable.
app.use((req, res, next) => {
  if (!isConnected() && req.path !== '/api/health') {
    return res.status(503).json({
      error: 'Database unreachable',
      detail:
        'The API could not connect to CognoDB. Check that your instance is running and that backend/.env has the correct COGNODB_URI/USER/PASSWORD.',
    });
  }
  next();
});

function handle(fn: (req: Request) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try {
      const data = await fn(req);
      res.json(data);
    } catch (err) {
      console.error(`[api] ${req.method} ${req.originalUrl} failed:`, (err as Error).message);
      res.status(500).json({ error: 'Query failed', detail: (err as Error).message });
    }
  };
}

app.get('/api/health', async (_req, res) => {
  const ok = await verifyConnectivity();
  res.status(ok ? 200 : 503).json({ connected: ok });
});

app.get('/api/skills', handle(() => q.listSkills()));
app.get('/api/skills/:name/prerequisites', handle((req) => q.getPrerequisiteChain(req.params.name)));

app.get('/api/roles', handle(() => q.listRoles()));
app.get('/api/roles/:title/gap', handle((req) => {
  const person = req.query.person as string;
  if (!person) throw new Error('Missing required query param: person');
  return q.getSkillGap(person, req.params.title);
}));
app.get('/api/roles/:title/path', handle((req) => {
  const person = req.query.person as string;
  if (!person) throw new Error('Missing required query param: person');
  return q.getLearningPath(person, req.params.title);
}));

app.get('/api/people', handle(() => q.listPeople()));
app.get('/api/people/:name', handle(async (req) => {
  const person = await q.getPersonDetail(req.params.name);
  if (!person) {
    const err = new Error(`No person named "${req.params.name}"`) as Error & { status?: number };
    err.status = 404;
    throw err;
  }
  return person;
}));

app.get('/api/insights/bridge-skills', handle((req) => {
  const minRoles = req.query.minRoles ? Number(req.query.minRoles) : 3;
  return q.getBridgeSkills(minRoles);
}));

app.get('/api/graph', handle(() => q.getGraphOverview()));

app.listen(PORT, async () => {
  console.log(`Skill Atlas API listening on port ${PORT}`);
  await verifyConnectivity();
});
