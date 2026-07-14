/**
 * Direct Postgres access for catalog/security assertions that PostgREST can't
 * express (pg_proc attributes, execute-privilege matrix, view-definition
 * behavior). Local-only: reads DATABASE_URL (the `supabase start` DB url,
 * e.g. postgresql://postgres:postgres@127.0.0.1:54322/postgres). When absent,
 * the security suite auto-skips.
 */
import { Client } from "pg";

export function dbUrl(): string | null {
  return process.env.DATABASE_URL ?? null;
}

export async function withDb<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const url = dbUrl();
  if (!url) throw new Error("DATABASE_URL not set");
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
