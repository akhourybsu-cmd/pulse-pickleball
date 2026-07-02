import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Shield } from "lucide-react";
import type { League, LeagueAuditEntry } from "@/lib/leagues/types";
import { EmptyState, TabSkeleton } from "./_shared";

export function AuditLogTab({ league }: { league: League }) {
  const [entries, setEntries] = useState<LeagueAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actorNames, setActorNames] = useState<Record<string, string>>({});
  const [prefixFilter, setPrefixFilter] = useState<string>("all");

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
          .from("profiles_public" as never)
          .select("id, display_name, full_name").in("id", ids);
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

  // Discover the entity prefixes present in this log so the filter
  // dropdown reflects reality (only show groups that have entries).
  const prefixes = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      const dot = e.action.indexOf(".");
      if (dot > 0) set.add(e.action.slice(0, dot));
    });
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    if (prefixFilter === "all") return entries;
    return entries.filter((e) => e.action.startsWith(`${prefixFilter}.`));
  }, [entries, prefixFilter]);

  if (loading) return <TabSkeleton lines={4} />;

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Shield className="w-5 h-5" />}
        title="No audit entries yet"
        desc="Every league edit will show up here — created, updated, added, removed, etc."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          Showing {filtered.length} of {entries.length}{entries.length === 200 && " (200 most recent)"}
        </div>
        <Select value={prefixFilter} onValueChange={setPrefixFilter}>
          <SelectTrigger className="w-[140px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {prefixes.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Shield className="w-5 h-5" />}
          title="No entries for that filter"
          desc="Try another action type or reset to All actions."
        />
      ) : (
        <ul className="space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.map((e) => (
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
      )}
    </div>
  );
}
