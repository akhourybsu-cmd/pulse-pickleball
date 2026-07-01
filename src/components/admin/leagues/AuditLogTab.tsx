import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { League, LeagueAuditEntry } from "@/lib/leagues/types";
import { Shield } from "lucide-react";

export function AuditLogTab({ league }: { league: League }) {
  const [entries, setEntries] = useState<LeagueAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("league_audit_log" as never).select("*")
        .eq("league_id", league.id).order("created_at", { ascending: false }).limit(200);
      const list = (data ?? []) as unknown as LeagueAuditEntry[];
      setEntries(list);
      if (list.length) {
        const ids = Array.from(new Set(list.map((e) => e.actor_user_id)));
        const { data: profs } = await supabase
          .from("profiles_public" as never).select("id, display_name, full_name").in("id", ids);
        const map: Record<string, string> = {};
        (profs ?? []).forEach((p) => {
          const row = p as { id: string; display_name: string | null; full_name: string | null };
          map[row.id] = row.display_name || row.full_name || row.id.slice(0, 8);
        });
        setActorNames(map);
      }
      setLoading(false);
    })();
  }, [league.id]);

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        <Shield className="w-5 h-5 mx-auto mb-2 opacity-70" />
        No audit entries yet. Every league edit will show up here.
      </div>
    );
  }

  return (
    <ul className="space-y-2 max-h-[600px] overflow-y-auto">
      {entries.map((e) => (
        <li key={e.id} className="rounded-lg border border-border/70 bg-card p-3 text-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="rounded-full bg-primary/10 text-primary text-[10px] font-mono px-1.5 py-0.5 shrink-0">
                {e.action}
              </span>
              <span className="text-muted-foreground text-xs truncate">
                {e.entity_type}
                {e.entity_id && <span className="opacity-60"> · {e.entity_id.slice(0, 8)}</span>}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground">
              {new Date(e.created_at).toLocaleString()}
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            by {actorNames[e.actor_user_id] ?? e.actor_user_id.slice(0, 8)}
          </div>
          {(e.old_value || e.new_value) && (
            <details className="mt-2">
              <summary className="text-[11px] cursor-pointer text-muted-foreground hover:text-foreground">
                Diff
              </summary>
              <pre className="mt-1 text-[10px] bg-muted/50 rounded p-2 overflow-x-auto">
{JSON.stringify({ old: e.old_value, new: e.new_value }, null, 2)}
              </pre>
            </details>
          )}
        </li>
      ))}
    </ul>
  );
}
