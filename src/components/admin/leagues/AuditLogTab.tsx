import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Shield, Search, CalendarClock, Swords, Users, Layers, Trophy,
  Flag, KeyRound, RefreshCw, UserPlus, Gavel, CalendarDays,
  Sparkles, FileText,
} from "lucide-react";
import type { League, LeagueAuditEntry } from "@/lib/leagues/types";
import { EmptyState, TabSkeleton } from "./_shared";
import { cn } from "@/lib/utils";

/**
 * Read-only audit tab. Takes dataVersion so it refetches after sibling
 * mutations, keeping the log fresh without a full page reload.
 *
 * Design notes:
 *  • Text search over action + entity_type + actor name.
 *  • Time grouping (Today / Yesterday / This week / Earlier) so admins
 *    can scan a long log quickly.
 *  • Per-prefix icon + tone chip so match/member/season actions are
 *    visually distinct.
 *  • Diff renderer intelligently shows changed fields when old + new
 *    are both objects, falling back to the raw JSON pre-block.
 */

interface ActionMeta {
  icon: typeof Shield;
  label: string;
  chip: string;
}

/**
 * Per-prefix visual signature. New action prefixes fall through to a
 * neutral default so we never break rendering on an unknown action.
 */
const PREFIX_META: Record<string, ActionMeta> = {
  league:  { icon: Trophy,       label: "League",  chip: "bg-[#A6DB5A]/15 text-[#A6DB5A]" },
  season:  { icon: CalendarDays, label: "Season",  chip: "bg-primary/15 text-primary" },
  division:{ icon: Layers,       label: "Division",chip: "bg-blue-500/15 text-blue-500" },
  team:    { icon: Users,        label: "Team",    chip: "bg-amber-500/15 text-amber-600" },
  team_member: { icon: UserPlus, label: "Roster",  chip: "bg-amber-500/15 text-amber-600" },
  match:   { icon: Swords,       label: "Match",   chip: "bg-violet-500/15 text-violet-500" },
  session: { icon: CalendarClock,label: "Session", chip: "bg-violet-500/15 text-violet-500" },
  member:  { icon: UserPlus,     label: "Member",  chip: "bg-emerald-500/15 text-emerald-600" },
  members: { icon: UserPlus,     label: "Members", chip: "bg-emerald-500/15 text-emerald-600" },
};

/**
 * Per-action title override. Action strings are code-ish (dot.snake);
 * this maps the most common ones to admin-facing English. Unknown
 * actions fall back to a title-cased version of the suffix.
 */
const ACTION_LABELS: Record<string, string> = {
  "league.created":              "League created",
  "league.updated":              "League updated",
  "league.archived":             "League archived",
  "league.invite_code_set":      "Invite code set",
  "league.invite_code_cleared":  "Invite code cleared",
  "season.created":              "Season created",
  "season.updated":              "Season updated",
  "season.lifecycle_synced":     "Season statuses synced",
  "division.created":            "Division created",
  "division.updated":            "Division updated",
  "team.created":                "Team created",
  "team.captain_changed":        "Captain changed",
  "team_member.added":           "Player added to team",
  "team_member.removed":         "Player removed from team",
  "team_member.restored":        "Player restored to team",
  "team_member.role_changed":    "Team role changed",
  "match.created":               "Match scheduled",
  "match.updated":               "Match edited",
  "match.score_submitted":       "Score submitted",
  "match.confirmed":             "Score confirmed",
  "match.verified":              "Match verified",
  "match.disputed":              "Score disputed",
  "match.dispute_resolved":      "Dispute resolved",
  "match.forfeited":             "Match forfeited",
  "session.created":             "Session created",
  "session.updated":             "Session updated",
  "member.joined_by_code":       "Joined via invite code",
  "member.rejoined_by_code":     "Rejoined via invite code",
  "members.bulk_added":          "Members bulk-added",
};

/**
 * Small icon override per action for the row card. Kept separate so
 * we can override individual actions without touching the prefix map.
 */
const ACTION_ICONS: Record<string, typeof Shield> = {
  "league.invite_code_set":     KeyRound,
  "league.invite_code_cleared": KeyRound,
  "match.forfeited":            Flag,
  "match.dispute_resolved":     Gavel,
  "match.disputed":             Gavel,
  "season.lifecycle_synced":    RefreshCw,
  "members.bulk_added":         Sparkles,
};

interface ProfileRow {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "··";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Bucket a Date into Today / Yesterday / This week / Earlier for
 * time-grouped rendering. Uses local midnight boundaries.
 */
function bucketOf(iso: string): "today" | "yesterday" | "week" | "earlier" {
  const then = new Date(iso);
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayMs = 24 * 60 * 60 * 1000;
  const diff = midnight.getTime() - then.getTime();
  if (then >= midnight) return "today";
  if (diff <= dayMs) return "yesterday";
  if (diff <= 7 * dayMs) return "week";
  return "earlier";
}

const BUCKET_LABELS: Record<ReturnType<typeof bucketOf>, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  earlier: "Earlier",
};

/**
 * Render the diff between old_value + new_value as a per-key change
 * list when both are plain objects. Falls back to a raw JSON block
 * when either side is missing or non-object.
 */
function DiffBlock({
  oldValue, newValue,
}: {
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
}) {
  const canPrettyDiff =
    oldValue && newValue &&
    typeof oldValue === "object" && typeof newValue === "object" &&
    !Array.isArray(oldValue) && !Array.isArray(newValue);

  if (canPrettyDiff) {
    const keys = Array.from(new Set([
      ...Object.keys(oldValue as object),
      ...Object.keys(newValue as object),
    ]));
    const changed = keys.filter((k) =>
      JSON.stringify((oldValue as Record<string, unknown>)[k])
      !== JSON.stringify((newValue as Record<string, unknown>)[k]));

    if (changed.length === 0) {
      return (
        <pre className="text-[10px] bg-muted/50 rounded p-2 overflow-x-auto">
{JSON.stringify(newValue, null, 2)}
        </pre>
      );
    }

    return (
      <ul className="space-y-1">
        {changed.map((k) => {
          const before = (oldValue as Record<string, unknown>)[k];
          const after = (newValue as Record<string, unknown>)[k];
          return (
            <li key={k} className="grid grid-cols-[auto_1fr_auto_1fr] gap-2 text-[11px] items-baseline">
              <span className="font-mono text-muted-foreground truncate">{k}</span>
              <span className="text-destructive font-mono truncate">
                {before === undefined ? "—" : JSON.stringify(before)}
              </span>
              <span className="text-muted-foreground">→</span>
              <span className="text-emerald-600 font-mono truncate">
                {after === undefined ? "—" : JSON.stringify(after)}
              </span>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <pre className="text-[10px] bg-muted/50 rounded p-2 overflow-x-auto">
{JSON.stringify({ old: oldValue, new: newValue }, null, 2)}
    </pre>
  );
}

export function AuditLogTab({
  league, dataVersion,
}: {
  league: League;
  dataVersion: number;
}) {
  const [entries, setEntries] = useState<LeagueAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [actors, setActors] = useState<Record<string, ProfileRow>>({});
  const [prefixFilter, setPrefixFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

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
          .select("id, display_name, full_name, avatar_url").in("id", ids);
        const map: Record<string, ProfileRow> = {};
        (profs ?? []).forEach((p) => {
          const r = p as ProfileRow;
          map[r.id] = r;
        });
        setActors(map);
      }
      setLoading(false);
    })();
  }, [league.id, dataVersion]);

  const actorName = (id: string): string => {
    const p = actors[id];
    return p?.display_name || p?.full_name || id.slice(0, 8);
  };

  // Discover the prefixes present in this log so the filter dropdown
  // only shows groups that actually appear.
  const prefixes = useMemo(() => {
    const set = new Set<string>();
    entries.forEach((e) => {
      const dot = e.action.indexOf(".");
      if (dot > 0) set.add(e.action.slice(0, dot));
    });
    return Array.from(set).sort();
  }, [entries]);

  // Prefix filter → text search, in that order.
  const filtered = useMemo(() => {
    let list = entries;
    if (prefixFilter !== "all") {
      list = list.filter((e) => e.action.startsWith(`${prefixFilter}.`));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((e) =>
        e.action.toLowerCase().includes(q)
        || (e.entity_type ?? "").toLowerCase().includes(q)
        || actorName(e.actor_user_id).toLowerCase().includes(q));
    }
    return list;
  }, [entries, prefixFilter, query, actors]);

  // Group into time buckets so admins can scan.
  const grouped = useMemo(() => {
    const g: Record<string, LeagueAuditEntry[]> = {
      today: [], yesterday: [], week: [], earlier: [],
    };
    filtered.forEach((e) => g[bucketOf(e.created_at)].push(e));
    return g;
  }, [filtered]);

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
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search action, entity, or actor…"
            className="pl-9 h-9"
          />
        </div>
        <Select value={prefixFilter} onValueChange={setPrefixFilter}>
          <SelectTrigger className="w-full sm:w-[160px] h-9 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {prefixes.map((p) => (
              <SelectItem key={p} value={p}>
                {PREFIX_META[p]?.label ?? p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-[11px] text-muted-foreground">
        Showing {filtered.length} of {entries.length}
        {entries.length === 200 && " · 200 most recent"}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Search className="w-5 h-5" />}
          title="No entries match"
          desc="Try a different search or reset the filter."
        />
      ) : (
        <div className="max-h-[600px] overflow-y-auto space-y-4 pr-1">
          {(["today", "yesterday", "week", "earlier"] as const).map((bucket) => {
            const rows = grouped[bucket];
            if (rows.length === 0) return null;
            return (
              <section key={bucket} className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground sticky top-0 bg-background py-1 border-b border-border/40 z-10">
                  {BUCKET_LABELS[bucket]}
                  <span className="ml-1.5 opacity-60">· {rows.length}</span>
                </div>
                <ul className="space-y-2">
                  {rows.map((e) => <AuditRow key={e.id} entry={e} actor={actors[e.actor_user_id]} actorName={actorName(e.actor_user_id)} />)}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AuditRow({
  entry, actor, actorName,
}: {
  entry: LeagueAuditEntry;
  actor: ProfileRow | undefined;
  actorName: string;
}) {
  const dot = entry.action.indexOf(".");
  const prefix = dot > 0 ? entry.action.slice(0, dot) : entry.action;
  const meta = PREFIX_META[prefix];
  const Icon = ACTION_ICONS[entry.action] ?? meta?.icon ?? FileText;
  const title = ACTION_LABELS[entry.action] ?? entry.action;
  const chipClass = meta?.chip ?? "bg-muted text-muted-foreground";

  return (
    <li className="rounded-lg border border-border/70 bg-card p-3 hover:border-border transition-colors">
      <div className="flex items-start gap-2.5">
        <div className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
          chipClass,
        )}>
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-semibold">{title}</span>
            <span
              className="text-[11px] text-muted-foreground tabular-nums shrink-0"
              title={new Date(entry.created_at).toLocaleString()}
            >
              {new Date(entry.created_at).toLocaleTimeString(undefined, {
                hour: "numeric", minute: "2-digit",
              })}
            </span>
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="font-mono opacity-70">{entry.action}</span>
            {entry.entity_id && (
              <>
                <span className="opacity-40">·</span>
                <span
                  className="font-mono opacity-70"
                  title={entry.entity_id}
                >
                  {entry.entity_id.slice(0, 8)}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center overflow-hidden ring-1 ring-border shrink-0">
              {actor?.avatar_url ? (
                <img src={actor.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[8px] font-bold text-muted-foreground">
                  {initialsOf(actorName)}
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              by <span className="font-medium text-foreground">{actorName}</span>
            </span>
          </div>
          {(entry.old_value || entry.new_value) && (
            <details className="mt-2 group">
              <summary className="text-[11px] cursor-pointer text-muted-foreground hover:text-foreground select-none">
                Show change
              </summary>
              <div className="mt-1.5">
                <DiffBlock
                  oldValue={entry.old_value as Record<string, unknown> | null}
                  newValue={entry.new_value as Record<string, unknown> | null}
                />
              </div>
            </details>
          )}
        </div>
      </div>
    </li>
  );
}
