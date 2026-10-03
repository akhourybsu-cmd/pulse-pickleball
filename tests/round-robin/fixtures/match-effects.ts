import { readFileSync } from "node:fs";
import type { PGlite } from "@electric-sql/pglite";
const read = (file: string) =>
  readFileSync(`supabase/migrations/${file}`, "utf8");
function fn(file: string, name: string) {
  const sql = read(file);
  const start = sql.search(
    new RegExp(`CREATE OR REPLACE FUNCTION public\\.${name}\\s*\\(`, "i"),
  );
  if (start < 0) throw new Error(name);
  const delimiter = sql.slice(start).match(/\bAS\s+(\$\w*\$)/i)![1];
  return sql.slice(
    start,
    sql.indexOf(`${delimiter};`, start) + delimiter.length + 1,
  );
}

export async function installMatchEffects(db:PGlite) {
  await db.exec(
    read("20251001193842_b730a111-5cad-446d-8a19-cf386b5726c7.sql").split(
      "-- Insert default parameters",
    )[0],
  );
  await db.exec(
    "INSERT INTO rating_parameters(id) VALUES('00000000-0000-0000-0000-000000000001')",
  );
  await db.exec(read("20260805170000_placement_scaffolding.sql"));
  await db.exec(
    fn(
      "20251001202644_99bdd03b-6c8d-4d44-ad36-8e80e38b393d.sql",
      "recalculate_all_player_stats",
    ),
  );
  await db.exec(
    fn(
      "20260805191005_43b6efc4-0a3b-4d7d-9f39-f165aae4f44d.sql",
      "recalculate_player_stats",
    ),
  );
  await db.exec(read("20260930171000_preserve_ranked_rating_in_stats.sql"));
  await db.exec(read("20260805180000_placement_engine_gated.sql"));
  await db.exec(
    fn(
      "20260703140000_incremental_rating_updates.sql",
      "handle_match_approval_recalc",
    ),
  );
  await db.exec(
    fn(
      "20251103175104_bf246f2e-780c-4d1f-9091-9bdda0411274.sql",
      "handle_match_status_change",
    ),
  );
  await db.exec(
    fn(
      "20260620004241_0dd46f8d-1de1-46e3-8a4a-0ea04e57298b.sql",
      "auto_approve_match_on_verification",
    ),
  );
  await db.exec(fn("20251103175104_bf246f2e-780c-4d1f-9091-9bdda0411274.sql", "handle_match_insert"));
  await db.exec(fn("20251103175104_bf246f2e-780c-4d1f-9091-9bdda0411274.sql", "handle_match_deletion"));
  await db.exec(`CREATE TRIGGER on_match_insert AFTER INSERT ON matches FOR EACH ROW EXECUTE FUNCTION handle_match_insert();
 CREATE TRIGGER on_match_delete AFTER DELETE ON matches FOR EACH ROW EXECUTE FUNCTION handle_match_deletion();
 CREATE TRIGGER on_match_approval_recalc AFTER INSERT OR UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION handle_match_approval_recalc();
 CREATE TRIGGER on_match_status_change AFTER UPDATE ON matches FOR EACH ROW EXECUTE FUNCTION handle_match_status_change();
 CREATE TRIGGER trigger_auto_approve_match AFTER INSERT OR UPDATE OF approved ON match_approvals FOR EACH ROW EXECUTE FUNCTION auto_approve_match_on_verification();`);
}
