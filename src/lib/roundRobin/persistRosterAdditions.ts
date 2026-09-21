import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type RosterAdditionRow =
  Database["public"]["Tables"]["round_robin_players"]["Insert"];

/** Keep a selection atomic without planning UPDATE policies for new arrivals. */
export async function persistRosterAdditions(
  client: SupabaseClient<Database>,
  rows: RosterAdditionRow[],
  hasReactivations: boolean,
): Promise<void> {
  if (rows.length === 0) return;

  const table = client.from("round_robin_players");
  // The production upsert expands both INSERT and UPDATE access rules, even
  // when every UUID is new. A new roster needs only one bulk INSERT. Keep the
  // existing single-statement upsert for a batch that includes returning rows.
  const { error } = hasReactivations
    ? await table.upsert(rows, { onConflict: "id" })
    : await table.insert(rows);

  // Never retry a failed write as individual inserts: its outcome may be
  // uncertain, and splitting the selection could leave a partial roster.
  if (error) throw error;
}
