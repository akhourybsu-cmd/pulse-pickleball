import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const MIGRATION_PATTERN = /^(\d{14})_(.+)\.sql$/;
const LEADING_SQL_COMMENTS = String.raw`(?:\s|--[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/)*`;
const OUTER_BEGIN_PATTERN = new RegExp(`^(${LEADING_SQL_COMMENTS})BEGIN\\s*;`, "i");
const OUTER_COMMIT_PATTERN = new RegExp(`COMMIT\\s*;(${LEADING_SQL_COMMENTS})$`, "i");

export function parseMigrationFilename(filename) {
  const match = filename.match(MIGRATION_PATTERN);
  if (!match) return null;

  return {
    version: match[1],
    name: match[2],
    filename,
  };
}

export function quoteSqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function unwrapOuterTransaction(sql) {
  const beginMatch = sql.match(OUTER_BEGIN_PATTERN);
  const commitMatch = sql.match(OUTER_COMMIT_PATTERN);

  if (Boolean(beginMatch) !== Boolean(commitMatch)) {
    throw new Error(
      "Migration has an incomplete outer transaction. Include both BEGIN; and COMMIT;, or neither.",
    );
  }

  if (!beginMatch || !commitMatch) return sql.trim();

  const bodyStart = beginMatch.index + beginMatch[0].length;
  const bodyEnd = commitMatch.index;
  return `${beginMatch[1]}${sql.slice(bodyStart, bodyEnd)}${commitMatch[1]}`.trim();
}

export function buildTransactionalMigrationSql(migration) {
  const body = unwrapOuterTransaction(migration.sql);
  const version = quoteSqlLiteral(migration.version);
  const name = quoteSqlLiteral(migration.name);

  return [
    "BEGIN;",
    "SELECT pg_advisory_xact_lock(672913804);",
    body,
    "INSERT INTO supabase_migrations.schema_migrations (version, name)",
    `VALUES (${version}, ${name});`,
    "COMMIT;",
  ].join("\n\n");
}

export function findPendingMigrations(localMigrations, remoteVersions) {
  const applied = new Set(remoteVersions.map(String));
  return localMigrations.filter(({ version }) => !applied.has(version));
}

export async function readLocalMigrations(migrationsDirectory) {
  const directoryEntries = await readdir(migrationsDirectory, { withFileTypes: true });
  const migrations = [];
  const versions = new Set();

  for (const entry of directoryEntries) {
    if (!entry.isFile()) continue;

    const parsed = parseMigrationFilename(entry.name);
    if (!parsed) continue;

    if (versions.has(parsed.version)) {
      throw new Error(`Duplicate migration version ${parsed.version} in ${migrationsDirectory}`);
    }

    versions.add(parsed.version);
    migrations.push({
      ...parsed,
      sql: await readFile(path.join(migrationsDirectory, entry.name), "utf8"),
    });
  }

  return migrations.sort((left, right) => left.version.localeCompare(right.version));
}

function apiErrorMessage(status, responseBody) {
  let detail = responseBody;

  try {
    const parsed = JSON.parse(responseBody);
    detail = parsed.message ?? parsed.error ?? responseBody;
  } catch {
    // The API can return a plain-text gateway error. Preserve it for diagnostics.
  }

  return `Supabase Management API returned ${status}: ${detail}`;
}

export async function executeSql({ accessToken, projectRef, query, readOnly, fetchImpl = fetch }) {
  const response = await fetchImpl(
    `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, read_only: readOnly }),
      signal: AbortSignal.timeout(10 * 60 * 1000),
    },
  );

  const responseBody = await response.text();
  if (!response.ok) {
    throw new Error(apiErrorMessage(response.status, responseBody));
  }

  if (!responseBody) return [];

  const parsed = JSON.parse(responseBody);
  if (Array.isArray(parsed)) return parsed;
  if (Array.isArray(parsed.data)) return parsed.data;

  throw new Error("Supabase Management API returned an unexpected query response.");
}

function validateEnvironment(accessToken, projectRef) {
  if (!accessToken?.startsWith("sbp_")) {
    throw new Error("SUPABASE_ACCESS_TOKEN is missing or is not a Supabase access token.");
  }

  if (!/^[a-z0-9]{20}$/.test(projectRef ?? "")) {
    throw new Error("SUPABASE_PROJECT_REF is missing or invalid.");
  }
}

export async function deployMigrations({
  accessToken,
  projectRef,
  migrationsDirectory,
  dryRun = false,
  fetchImpl = fetch,
}) {
  validateEnvironment(accessToken, projectRef);

  const localMigrations = await readLocalMigrations(migrationsDirectory);
  const rows = await executeSql({
    accessToken,
    projectRef,
    query: "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;",
    readOnly: true,
    fetchImpl,
  });
  const remoteVersions = rows.map(({ version }) => String(version));
  const pending = findPendingMigrations(localMigrations, remoteVersions);

  console.log(
    `Migration audit: ${localMigrations.length} local, ${remoteVersions.length} recorded, ${pending.length} pending.`,
  );

  if (pending.length === 0) {
    console.log("Database is current; no migrations to apply.");
    return { applied: [], pending: [] };
  }

  for (const migration of pending) {
    console.log(`${dryRun ? "Would apply" : "Applying"} ${migration.filename}`);
  }

  if (dryRun) {
    console.log("Dry run complete; the database was not changed.");
    return { applied: [], pending };
  }

  const applied = [];
  for (const migration of pending) {
    await executeSql({
      accessToken,
      projectRef,
      query: buildTransactionalMigrationSql(migration),
      readOnly: false,
      fetchImpl,
    });
    applied.push(migration.version);
    console.log(`Applied ${migration.filename}`);
  }

  console.log(`Migration deployment complete: ${applied.length} applied.`);
  return { applied, pending };
}

async function main() {
  const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
  const repositoryRoot = path.resolve(scriptDirectory, "..");

  await deployMigrations({
    accessToken: process.env.SUPABASE_ACCESS_TOKEN,
    projectRef: process.env.SUPABASE_PROJECT_REF,
    migrationsDirectory: path.join(repositoryRoot, "supabase", "migrations"),
    dryRun: process.argv.includes("--dry-run"),
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
