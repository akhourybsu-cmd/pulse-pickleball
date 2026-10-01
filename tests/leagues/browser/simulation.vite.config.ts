import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";
import { leagueSimulationDatabase } from "../../helpers/leagueSimulationDatabase";
import { leagueSimulationClient } from "../../helpers/leagueSimulationClient";
import { seedLeagueBrowserSimulation } from "../../helpers/leagueBrowserSimulation";

const client = path.resolve(__dirname, "simulation-client.tsx");
export default defineConfig({
  cacheDir: ".qa-cache/league-simulation-vite",
  optimizeDeps: { entries: ["tests/leagues/browser/simulation.html"] },
  plugins: [
    react(),
    {
      name: "isolated-league-database",
      async configureServer(server) {
        const db = await leagueSimulationDatabase();
        const state = await seedLeagueBrowserSimulation(db);
        server.httpServer?.once("close", () => void db.close());
        server.middlewares.use("/__league-sim", async (req, res) => {
          res.setHeader("Content-Type", "application/json");
          try {
            if (req.method === "GET") {
              res.end(
                JSON.stringify({
                  league: state.league,
                  season: state.season,
                  users: state.users,
                })
              );
              return;
            }
            let raw = "";
            for await (const chunk of req) raw += chunk;
            const action = JSON.parse(raw);
            if (!state.users.some((user) => user.id === action.user))
              throw new Error("Unknown simulation user");
            const api = leagueSimulationClient(db, action.user);
            let result;
            if (action.kind === "rpc")
              result = await api.rpc(action.name, action.args);
            else if (action.kind === "function") {
              const handler = state.handlers[action.name];
              if (!handler) throw new Error("Unsupported simulation function");
              const output = await handler(action.user, action.args);
              result =
                output.status >= 400
                  ? {
                      data: null,
                      error: {
                        message: output.body.message ?? output.body.error,
                      },
                    }
                  : { data: output.body, error: null };
            } else {
              let query: any = api.from(action.table);
              const methods = new Set([
                "select",
                "eq",
                "neq",
                "is",
                "in",
                "not",
                "order",
                "limit",
                "range",
                "or",
                "ilike",
                "single",
                "maybeSingle",
                "insert",
                "update",
                "upsert",
                "delete",
              ]);
              for (const [method, args] of action.steps) {
                if (!methods.has(method)) throw new Error("Unsupported query");
                query = query[method](...args);
              }
              result = await query;
            }
            res.end(JSON.stringify(result));
          } catch (error) {
            res.statusCode = 400;
            res.end(
              JSON.stringify({
                data: null,
                error: { message: (error as Error).message },
              })
            );
          }
        });
      },
    },
  ],
  resolve: {
    alias: [
      { find: /^\.\/useAuthState$/, replacement: client },
      ...[
        "hooks/useAuthState",
        "integrations/supabase/client",
        "lib/skill/featureFlag",
      ].map((name) => ({ find: `@/${name}`, replacement: client })),
      { find: "@", replacement: path.resolve(__dirname, "../../../src") },
    ],
  },
});
