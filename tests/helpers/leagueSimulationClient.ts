import { build } from "esbuild";
import { resolve } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { leagueActor } from "./leagueSimulationDatabase";

const ident = (name: string) => {
  if (!/^[a-z_][a-z_0-9]*$/i.test(name))
    throw new Error(`Unsupported identifier: ${name}`);
  return `"${name}"`;
};
type Row = Record<string, any>;
const jsonValue = (value: unknown) => JSON.parse(JSON.stringify(value));

/** Minimal PostgREST transport backed by PostgreSQL, not fabricated results.
 * Every statement executes as its caller, with production RLS and triggers. */
export function leagueSimulationClient(
  db: PGlite,
  user: string | null,
  service = false
) {
  const query = leagueActor(db, user, service);
  const execute = async (work: () => Promise<unknown>) => {
    try {
      return { data: jsonValue(await work()), error: null };
    } catch (error) {
      return { data: null, error: { message: (error as Error).message } };
    }
  };
  return {
    auth: {
      getUser: async () => ({
        data: { user: user ? { id: user } : null },
        error: null,
      }),
    },
    rpc: async (name: string, args: Row = {}) =>
      execute(async () => {
        const keys = Object.keys(args);
        const values = keys.map((key) =>
          typeof args[key] === "object" &&
          args[key] !== null &&
          (!Array.isArray(args[key]) || ["p_scores", "p_plan"].includes(key))
            ? JSON.stringify(args[key])
            : args[key]
        );
        const result = await query(
          `SELECT * FROM public.${ident(name)}(${keys.map((key, i) => `${ident(key)} => $${i + 1}`).join(",")})`,
          values
        );
        if (result.fields.length === 1 && result.fields[0].name === name)
          return result.rows[0]?.[name] ?? null;
        return result.rows;
      }),
    from: (table: string) => {
      const params: unknown[] = [],
        filters: string[] = [],
        orders: string[] = [];
      let single = false,
        limit: number | null = null,
        offset = 0,
        columns = "*",
        op = "select",
        payload: Row | Row[] = {},
        conflict = "",
        head = false,
        shouldThrow = false,
        ignoreDuplicates = false;
      const bind = (value: unknown) => {
        params.push(value);
        return `$${params.length}`;
      };
      const builder = {
        select(value = "*", options: Row = {}) {
          columns = value;
          head = !!options.head;
          return builder;
        },
        eq(key: string, value: unknown) {
          filters.push(`${ident(key)}=${bind(value)}`);
          return builder;
        },
        neq(key: string, value: unknown) {
          filters.push(`${ident(key)}<>${bind(value)}`);
          return builder;
        },
        is(key: string, value: null | boolean) {
          if (value !== null && typeof value !== "boolean")
            throw new Error("Unsupported IS filter");
          filters.push(
            `${ident(key)} IS ${value === null ? "NULL" : value ? "TRUE" : "FALSE"}`
          );
          return builder;
        },
        ilike(key: string, value: string) {
          filters.push(`${ident(key)} ILIKE ${bind(value)}`);
          return builder;
        },
        or(expression: string) {
          filters.push(
            `(${expression
              .split(",")
              .map((term) => {
                const match = /^([a-z_][a-z_0-9]*)\.(eq|ilike)\.(.*)$/i.exec(
                  term
                );
                if (!match) throw new Error("Unsupported OR filter");
                return `${ident(match[1])} ${match[2] === "eq" ? "=" : "ILIKE"} ${bind(match[3])}`;
              })
              .join(" OR ")})`
          );
          return builder;
        },
        in(key: string, values: unknown[]) {
          filters.push(`${ident(key)}=ANY(${bind(values)})`);
          return builder;
        },
        not(key: string, operator: string, value: unknown) {
          if (operator !== "is" || value !== null)
            throw new Error("Unsupported filter");
          filters.push(`${ident(key)} IS NOT NULL`);
          return builder;
        },
        order(key: string, options: Row = {}) {
          orders.push(
            `${ident(key)} ${options.ascending === false ? "DESC" : "ASC"}`
          );
          return builder;
        },
        limit(value: number) {
          limit = value;
          return builder;
        },
        range(from: number, to: number) {
          offset = from;
          limit = to - from + 1;
          return builder;
        },
        maybeSingle() {
          single = true;
          return builder;
        },
        single() {
          single = true;
          return builder;
        },
        throwOnError() {
          shouldThrow = true;
          return builder;
        },
        update(value: Row) {
          op = "update";
          payload = value;
          return builder;
        },
        insert(value: Row | Row[]) {
          op = "insert";
          payload = value;
          return builder;
        },
        upsert(value: Row | Row[], options: Row = {}) {
          op = "upsert";
          payload = value;
          conflict = options.onConflict ?? "";
          ignoreDuplicates = !!options.ignoreDuplicates;
          return builder;
        },
        delete() {
          op = "delete";
          return builder;
        },
        then(
          onFulfilled: (result: Row) => unknown,
          onRejected?: (error: unknown) => unknown
        ) {
          return (async () => {
            try {
              const where = filters.length
                ? ` WHERE ${filters.join(" AND ")}`
                : "";
              let sql: string;
              if (op === "select") {
                const projection = columns.includes("leagues!inner(")
                  ? `*,(SELECT jsonb_build_object('status',l.status) FROM leagues l WHERE l.id=league_seasons.league_id) AS leagues`
                  : "*";
                sql = `SELECT ${projection} FROM ${ident(table)}${where}${orders.length ? ` ORDER BY ${orders.join(",")}` : ""}${limit == null ? "" : ` LIMIT ${Number(limit)}`}${offset ? ` OFFSET ${Number(offset)}` : ""}`;
              } else if (op === "update") {
                sql = `UPDATE ${ident(table)} SET ${Object.entries(payload)
                  .map(([key, value]) => `${ident(key)}=${bind(value)}`)
                  .join(",")}${where} RETURNING *`;
              } else if (op === "delete") {
                sql = `DELETE FROM ${ident(table)}${where} RETURNING *`;
              } else {
                const rows = Array.isArray(payload) ? payload : [payload];
                const keys = Object.keys(rows[0]);
                sql = `INSERT INTO ${ident(table)} (${keys.map(ident).join(",")}) VALUES ${rows.map((row) => `(${keys.map((key) => bind(row[key])).join(",")})`).join(",")}`;
                if (op === "upsert")
                  sql += ` ON CONFLICT (${conflict.split(",").map(ident).join(",")}) DO ${
                    ignoreDuplicates
                      ? "NOTHING"
                      : `UPDATE SET ${keys
                          .filter((key) => !conflict.split(",").includes(key))
                          .map((key) => `${ident(key)}=EXCLUDED.${ident(key)}`)
                          .join(",")}`
                  }`;
                sql += " RETURNING *";
              }
              const result = await query(sql, params);
              // PostgREST emits SQL dates as YYYY-MM-DD; PGlite uses Date objects.
              for (const field of result.fields)
                if (field.dataTypeID === 1082) {
                  for (const row of result.rows)
                    if (row[field.name] instanceof Date)
                      row[field.name] = (row[field.name] as Date)
                        .toISOString()
                        .slice(0, 10);
                }
              return {
                data: jsonValue(
                  head ? null : single ? (result.rows[0] ?? null) : result.rows
                ),
                error: null,
                count: result.rows.length,
              };
            } catch (error) {
              if (shouldThrow) throw error;
              return {
                data: null,
                error: { message: (error as Error).message },
                count: null,
              };
            }
          })().then(onFulfilled, onRejected);
        },
      };
      return builder;
    },
  };
}

/** Bundle unchanged Deno handlers; replace only the Supabase HTTP transport.
 * No hosted credentials, sockets, fake ladder plans, or rewritten outcomes. */
export async function leagueEdgeHandler(db: PGlite, name: string) {
  const source = await build({
    entryPoints: [resolve(`supabase/functions/${name}/index.ts`)],
    bundle: true,
    write: false,
    format: "iife",
    platform: "neutral",
    plugins: [
      {
        name: "isolated-supabase-transport",
        setup(builder) {
          builder.onResolve(
            { filter: /^https:\/\/esm\.sh\/@supabase\/supabase-js/ },
            () => ({ path: "client", namespace: "league-sim" })
          );
          builder.onLoad({ filter: /.*/, namespace: "league-sim" }, () => ({
            contents:
              "export const createClient = (...args) => __createClient(...args);",
            loader: "js",
          }));
        },
      },
    ],
  });
  let handler!: (request: Request) => Promise<Response>;
  const deno = {
    env: {
      get: (key: string) =>
        key === "SUPABASE_SERVICE_ROLE_KEY"
          ? "isolated-service"
          : "isolated-anon",
    },
    serve: (callback: typeof handler) => {
      handler = callback;
    },
  };
  const createClient = (_url: string, key: string, options: Row = {}) =>
    leagueSimulationClient(
      db,
      options.global?.headers?.Authorization?.replace(/^Bearer /, "") ?? null,
      key === "isolated-service"
    );
  new Function("Deno", "__createClient", source.outputFiles[0].text)(
    deno,
    createClient
  );
  return async (user: string | null, body: Row) => {
    const response = await handler(
      new Request("https://isolated.test/league", {
        method: "POST",
        headers: user ? { Authorization: `Bearer ${user}` } : {},
        body: JSON.stringify(body),
      })
    );
    return { status: response.status, body: (await response.json()) as Row };
  };
}
