import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildTransactionalMigrationSql,
  deployMigrations,
  executeSql,
  findPendingMigrations,
  parseMigrationFilename,
  quoteSqlLiteral,
  unwrapOuterTransaction,
  verifyWriteAccess,
} from "./deploy-supabase-migrations.mjs";

test("parses timestamped migration filenames", () => {
  assert.deepEqual(parseMigrationFilename("20260910280000_optimize_guest_players_rls.sql"), {
    version: "20260910280000",
    name: "optimize_guest_players_rls",
    filename: "20260910280000_optimize_guest_players_rls.sql",
  });
  assert.equal(parseMigrationFilename(".verify_rr_drift.sql"), null);
});

test("quotes SQL literals safely", () => {
  assert.equal(quoteSqlLiteral("owner's migration"), "'owner''s migration'");
});

test("unwraps a migration-owned outer transaction", () => {
  const sql = "-- explanation\nBEGIN;\nCREATE TABLE example(id int);\nCOMMIT;\n";
  assert.equal(
    unwrapOuterTransaction(sql),
    "-- explanation\n\nCREATE TABLE example(id int);",
  );
});

test("rejects an incomplete outer transaction", () => {
  assert.throws(
    () => unwrapOuterTransaction("BEGIN;\nSELECT 1;"),
    /incomplete outer transaction/,
  );
  assert.throws(
    () => unwrapOuterTransaction("SELECT 1;\nCOMMIT;"),
    /incomplete outer transaction/,
  );
});

test("builds an atomic migration plus history record", () => {
  const sql = buildTransactionalMigrationSql({
    version: "20260911000000",
    name: "add_example",
    sql: "CREATE TABLE example(id int);",
  });

  assert.match(sql, /^BEGIN;/);
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /CREATE TABLE example/);
  assert.match(sql, /INSERT INTO supabase_migrations\.schema_migrations/);
  assert.match(sql, /VALUES \('20260911000000', 'add_example'\);/);
  assert.match(sql, /COMMIT;$/);
});

test("wraps the release migration exactly once without stripping function blocks", async () => {
  const migrationSql = await readFile(
    new URL(
      "../supabase/migrations/20260912100000_round_robin_atomic_schedule_rebuild.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const sql = buildTransactionalMigrationSql({
    version: "20260912100000",
    name: "round_robin_atomic_schedule_rebuild",
    sql: migrationSql,
  });

  assert.equal(sql.match(/^BEGIN;$/gm)?.length, 1);
  assert.equal(sql.match(/^COMMIT;$/gm)?.length, 1);
  assert.match(
    sql,
    /CREATE OR REPLACE FUNCTION public\.rr_apply_schedule_rebuild[\s\S]*?AS \$\$[\s\S]*?BEGIN/,
  );
  assert.ok(
    sql.indexOf("CREATE OR REPLACE FUNCTION public.rr_substitute_round")
      < sql.indexOf("INSERT INTO supabase_migrations.schema_migrations"),
  );
  assert.match(sql, /INSERT INTO supabase_migrations\.schema_migrations[\s\S]*COMMIT;$/);
});

test("finds pending migrations without numeric timestamp conversion", () => {
  const local = [
    { version: "20260910270000" },
    { version: "20260910280000" },
    { version: "20260911000000" },
  ];

  assert.deepEqual(
    findPendingMigrations(local, ["20260910270000", "20260910280000"]),
    [{ version: "20260911000000" }],
  );
});

test("sends SQL through the scoped Management API", async () => {
  let request;
  const rows = await executeSql({
    accessToken: "sbp_test_token",
    projectRef: "abcdefghijklmnopqrst",
    query: "SELECT version FROM supabase_migrations.schema_migrations;",
    readOnly: true,
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify([{ version: "20260910280000" }]), {
        status: 201,
      });
    },
  });

  assert.deepEqual(rows, [{ version: "20260910280000" }]);
  assert.equal(
    request.url,
    "https://api.supabase.com/v1/projects/abcdefghijklmnopqrst/database/query",
  );
  assert.equal(request.options.headers.Authorization, "Bearer sbp_test_token");
  assert.deepEqual(JSON.parse(request.options.body), {
    query: "SELECT version FROM supabase_migrations.schema_migrations;",
    read_only: true,
  });
});

test("verifies write capability without leaving a database change", async () => {
  let requestBody;

  await verifyWriteAccess({
    accessToken: "sbp_test_token",
    projectRef: "abcdefghijklmnopqrst",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return new Response("[]", { status: 201 });
    },
  });

  assert.equal(requestBody.read_only, false);
  assert.match(requestBody.query, /^BEGIN;/);
  assert.match(requestBody.query, /pg_advisory_xact_lock/);
  assert.match(requestBody.query, /ROLLBACK;$/);
});

test("dry-run preflights every migration envelope before testing write access", async () => {
  const migrationsDirectory = await mkdtemp(
    path.join(tmpdir(), "pulse-migration-envelope-"),
  );

  try {
    await writeFile(
      path.join(migrationsDirectory, "20260913000000_incomplete.sql"),
      "BEGIN;\nSELECT 1;\n",
      "utf8",
    );

    let requests = 0;
    await assert.rejects(
      deployMigrations({
        accessToken: "sbp_test_token",
        projectRef: "abcdefghijklmnopqrst",
        migrationsDirectory,
        dryRun: true,
        fetchImpl: async () => {
          requests += 1;
          return new Response("[]", { status: 200 });
        },
      }),
      /incomplete outer transaction/,
    );

    // Only the read-only migration-history query ran. The write-capability
    // probe is intentionally skipped after a local preflight failure.
    assert.equal(requests, 1);
  } finally {
    await rm(migrationsDirectory, { recursive: true, force: true });
  }
});
