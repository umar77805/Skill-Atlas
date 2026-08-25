import neo4j, { type Driver } from 'neo4j-driver';
import 'dotenv/config';

const { COGNODB_URI, COGNODB_USER, COGNODB_PASSWORD } = process.env;

if (!COGNODB_URI || !COGNODB_USER || !COGNODB_PASSWORD) {
  console.error(
    '[db] Missing COGNODB_URI / COGNODB_USER / COGNODB_PASSWORD env vars. ' +
      'Copy backend/.env.example to backend/.env and fill in your CognoDB Cloud connection details.'
  );
}

export const driver: Driver = neo4j.driver(
  COGNODB_URI as string,
  neo4j.auth.basic(COGNODB_USER as string, COGNODB_PASSWORD as string),
  {
    maxConnectionPoolSize: 20,
    // Our counts/depths are always small, so return plain JS numbers instead
    // of Neo4j's lossless Integer wrapper - keeps API responses simple JSON.
    disableLosslessIntegers: true,
  }
);

let verified = false;

// Confirms we can actually reach CognoDB. Called once at server boot so we fail
// fast with a clear message instead of surfacing a cryptic error on first request.
export async function verifyConnectivity(): Promise<boolean> {
  try {
    await driver.verifyConnectivity();
    verified = true;
    console.log('[db] Connected to CognoDB.');
  } catch (err) {
    verified = false;
    console.error('[db] Could not connect to CognoDB:', (err as Error).message);
  }
  return verified;
}

export function isConnected(): boolean {
  return verified;
}

// Runs a single Cypher statement in a managed session and returns plain-JS records.
// Always parameterised by the caller - never build Cypher via string concatenation.
export async function runQuery<T = Record<string, unknown>>(
  cypher: string,
  params: Record<string, unknown> = {}
): Promise<T[]> {
  const session = driver.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((r) => r.toObject() as T);
  } finally {
    await session.close();
  }
}

export async function closeDriver(): Promise<void> {
  await driver.close();
}
