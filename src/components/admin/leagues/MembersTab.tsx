import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus, Search, UserX, Users, RotateCcw, ClipboardList, Mail, CheckCircle2,
  XCircle, RotateCw, AlertCircle, Crown,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  EmptyState, TabSkeleton, LeagueTabProps,
  FormShell, FormSection, FormRow, FIELD_H, SegmentedControl, SeasonSelect,
} from "./_shared";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type {
  League, LeagueSeason, LeagueDivision, LeagueMember, MemberRole,
  MemberStatus,
} from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { resolvePlayerName } from "@/lib/matchDisplay";

interface PlayerRow {
  id: string;
  display_name: string | null;
  full_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

export function MembersTab({ league, dataVersion, onMutated }: LeagueTabProps) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, PlayerRow>>({});
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Season list — subscribes to dataVersion so new seasons show up here.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("league_seasons" as never).select("*")
        .eq("league_id", league.id).order("created_at", { ascending: false });
      const list = (data ?? []) as unknown as LeagueSeason[];
      setSeasons(list);
      if (list.length && !seasonId) setSeasonId(list[0].id);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [league.id, dataVersion]);

  useEffect(() => {
    if (!seasonId) return;
    void reload();
    // eslint-disable-next-line
  }, [seasonId, dataVersion]);

  const reload = async () => {
    const [{ data: divs }, { data: mems }] = await Promise.all([
      supabase.from("league_divisions" as never).select("*").eq("season_id", seasonId),
      supabase.from("league_members" as never).select("*")
        .eq("league_id", league.id).eq("season_id", seasonId).order("joined_at", { ascending: false }),
    ]);
    setDivisions((divs ?? []) as unknown as LeagueDivision[]);
    const memList = (mems ?? []) as unknown as LeagueMember[];
    setMembers(memList);
    if (memList.length) {
      const ids = Array.from(new Set(memList.map((m) => m.user_id)));
      const { data: profs } = await supabase
        .from("profiles_public" as never)
        .select("id, display_name, full_name, first_name, last_name, avatar_url")
        .in("id", ids);
      const map: Record<string, PlayerRow> = {};
      (profs ?? []).forEach((p) => { map[(p as PlayerRow).id] = p as PlayerRow; });
      setProfilesById(map);
    } else {
      setProfilesById({});
    }
  };

  if (loading) return <TabSkeleton lines={3} />;
  if (seasons.length === 0) {
    return (
      <EmptyState
        icon={<Users className="w-5 h-5" />}
        title="Create a season first"
        desc="Members are scoped to a season so history stays clean."
      />
    );
  }

  // Filter members by the search query (name substring). Case-insensitive.
  const q = query.trim().toLowerCase();
  const filteredMembers = q
    ? members.filter((m) => {
        const p = profilesById[m.user_id];
        if (!p) return false;
        const name = resolvePlayerName(p).toLowerCase();
        return name.includes(q);
      })
    : members;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <SeasonSelect seasons={seasons} value={seasonId} onChange={setSeasonId} className="flex-1" />
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" />Add member</Button>
          </DialogTrigger>
          {seasonId && (
            <AddMemberDialog
              league={league}
              seasonId={seasonId}
              divisions={divisions}
              existingUserIds={new Set(members.map((m) => m.user_id))}
              onDone={async () => { setAddOpen(false); await reload(); onMutated(); }}
            />
          )}
        </Dialog>
        <Dialog open={bulkOpen} onOpenChange={setBulkOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" title="Paste an email list">
              <ClipboardList className="w-4 h-4 mr-1" />Bulk
            </Button>
          </DialogTrigger>
          {seasonId && (
            <BulkAddMembersDialog
              league={league}
              seasonId={seasonId}
              divisions={divisions}
              onDone={async () => { setBulkOpen(false); await reload(); onMutated(); }}
            />
          )}
        </Dialog>
      </div>

      {/* Search bar — visible whenever there's more than a handful of
          members. Below that it's just noise. */}
      {members.length > 4 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${members.length} member${members.length === 1 ? "" : "s"}…`}
            className="pl-9 h-10"
          />
        </div>
      )}

      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="w-5 h-5" />}
          title="No members in this season"
          desc="Search for existing players and add them as league members."
          action={{ label: "Add member", onClick: () => setAddOpen(true) }}
        />
      ) : filteredMembers.length === 0 ? (
        <EmptyState
          icon={<Search className="w-5 h-5" />}
          title="No matches"
          desc={`No members match "${query}".`}
        />
      ) : (
        <ul className="space-y-2">
          {filteredMembers.map((m) => {
            const p = profilesById[m.user_id];
            const name = p ? resolvePlayerName(p) : "Loading…";
            const division = divisions.find((d) => d.id === m.division_id);
            const initials = name
              .split(/\s+/).filter(Boolean).slice(0, 2)
              .map((s) => s[0]).join("").toUpperCase() || "?";
            return (
              <li key={m.id} className="rounded-lg border border-border/70 bg-card p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-center gap-3 min-w-0 sm:flex-1">
                  {/* Avatar chip — pulls from profile.avatar_url when
                      available, initials otherwise. Small enough to not
                      dominate the row. */}
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border">
                    {p?.avatar_url ? (
                      <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-[11px] font-bold text-muted-foreground">
                        {initials}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-1">
                      <span className={cn(
                        "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                        m.role === "player"
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary ring-1 ring-primary/20",
                      )}>
                        {m.role === "captain" && <Crown className="w-2.5 h-2.5" />}
                        {m.role}
                      </span>
                      {m.status !== "active" && (
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                          m.status === "removed"
                            ? "bg-destructive/10 text-destructive"
                            : "bg-amber-500/10 text-amber-600",
                        )}>
                          {m.status}
                        </span>
                      )}
                      {division && <span className="text-muted-foreground">{division.name}</span>}
                    </div>
                  </div>
                </div>
                <MemberInlineActions
                  league={league}
                  member={m}
                  memberName={name}
                  divisions={divisions}
                  onChanged={async () => { await reload(); onMutated(); }}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MemberInlineActions({
  league, member, memberName, divisions, onChanged,
}: {
  league: League;
  member: LeagueMember;
  memberName: string;
  divisions: LeagueDivision[];
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);
  const isRemoved = member.status === "removed";

  const patch = async (fields: Partial<LeagueMember>, action: string) => {
    setBusy(true);
    const { error } = await supabase.from("league_members" as never)
      .update(fields as never).eq("id", member.id);
    if (error) { toast.error(error.message); setBusy(false); return; }
    await logLeagueAction({
      leagueId: league.id, seasonId: member.season_id,
      action, entityType: "member", entityId: member.id,
      oldValue: { role: member.role, status: member.status, division_id: member.division_id },
      newValue: fields,
    });
    setBusy(false);
    await onChanged();
  };

  return (
    <div className="flex items-center gap-1 w-full sm:w-auto">
      <Select
        value={member.role}
        onValueChange={(v) => patch({ role: v as MemberRole }, "member.role_changed")}
      >
        <SelectTrigger className="h-8 flex-1 sm:flex-none sm:w-[110px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="player">Player</SelectItem>
          <SelectItem value="captain">Captain</SelectItem>
          <SelectItem value="manager">Manager</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={member.division_id ?? "none"}
        onValueChange={(v) => patch({ division_id: v === "none" ? null : v }, "member.division_changed")}
      >
        <SelectTrigger className="h-8 flex-1 sm:flex-none sm:w-[130px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">No division</SelectItem>
          {divisions.map((d) => (
            <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Restore is benign — direct action. Remove needs a confirm. */}
      {isRemoved ? (
        <Button
          variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground"
          disabled={busy}
          onClick={() => patch({ status: "active" }, "member.restored")}
          aria-label="Restore member"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
      ) : (
        <>
          <Button
            variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive"
            disabled={busy}
            onClick={() => setConfirmRemoveOpen(true)}
            aria-label="Remove member"
          >
            <UserX className="w-4 h-4" />
          </Button>
          <AlertDialog open={confirmRemoveOpen} onOpenChange={setConfirmRemoveOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove this member from the season?</AlertDialogTitle>
                <AlertDialogDescription>
                  {memberName} will be marked removed. This is a soft delete —
                  you can restore them later. Their existing team assignments
                  will remain unless you also remove them from those teams.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setConfirmRemoveOpen(false);
                    await patch({ status: "removed" }, "member.removed");
                  }}
                >
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}

function AddMemberDialog({
  league, seasonId, divisions, existingUserIds, onDone,
}: {
  league: League;
  seasonId: string;
  divisions: LeagueDivision[];
  existingUserIds: Set<string>;
  onDone: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlayerRow[]>([]);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [role, setRole] = useState<MemberRole>("player");
  const [divisionId, setDivisionId] = useState<string | "none">("none");
  const [status, setStatus] = useState<MemberStatus>("active");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const q = query.trim();
    const t = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles_public" as never)
        .select("id, display_name, full_name, first_name, last_name, avatar_url")
        .or(`display_name.ilike.%${q}%,full_name.ilike.%${q}%,first_name.ilike.%${q}%,last_name.ilike.%${q}%`)
        .limit(20);
      setResults((data ?? []) as unknown as PlayerRow[]);
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const filteredResults = useMemo(
    () => results.filter((r) => !existingUserIds.has(r.id)),
    [results, existingUserIds],
  );

  const submit = async () => {
    if (!pickedId) { toast.error("Pick a player"); return; }
    setSaving(true);
    const payload = {
      league_id: league.id,
      season_id: seasonId,
      division_id: divisionId === "none" ? null : divisionId,
      user_id: pickedId,
      role, status,
    };
    const { data, error } = await supabase
      .from("league_members" as never).insert(payload as never).select().single();
    if (error || !data) {
      toast.error(error?.message ?? "Add failed");
      setSaving(false);
      return;
    }
    await logLeagueAction({
      leagueId: league.id, seasonId,
      action: "member.added", entityType: "member",
      entityId: (data as unknown as LeagueMember).id,
      newValue: payload,
    });
    toast.success("Member added");
    setSaving(false);
    await onDone();
  };

  const pickedRow = results.find((r) => r.id === pickedId);
  const pickedName = pickedRow ? resolvePlayerName(pickedRow) : "";

  return (
    <FormShell
      icon={<Users className="w-5 h-5" />}
      tone="primary"
      kicker="New member"
      title="Add to the roster"
      subtitle="Search your players and sign them to this season."
      primaryLabel="Add member"
      primaryLoading={saving}
      primaryDisabled={!pickedId}
      onPrimary={submit}
    >
      <FormSection label="Player">
        <FormRow label="Search players" htmlFor="mem-search">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="mem-search"
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Name…" className={cn(FIELD_H, "pl-9")}
            />
          </div>
        </FormRow>
        {filteredResults.length > 0 && (
          <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border/60">
            {filteredResults.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setPickedId(r.id)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors",
                  pickedId === r.id && "bg-primary/10 text-primary font-semibold",
                )}
              >
                {resolvePlayerName(r)}
              </button>
            ))}
          </div>
        )}
        {query && filteredResults.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No matches (already-added players are filtered out).
          </p>
        )}
        {pickedId && pickedName && (
          <p className="text-xs text-primary font-medium">Signed: {pickedName}</p>
        )}
      </FormSection>

      <FormSection label="Assignment">
        <FormRow label="Role">
          <SegmentedControl
            value={role}
            onChange={(v) => setRole(v as MemberRole)}
            options={[
              { value: "player",  label: "Player" },
              { value: "captain", label: "Captain" },
              { value: "manager", label: "Manager" },
            ]}
          />
        </FormRow>
        <FormRow label="Status">
          <SegmentedControl
            value={status}
            onChange={(v) => setStatus(v as MemberStatus)}
            options={[
              { value: "active",  label: "Active" },
              { value: "pending", label: "Pending" },
            ]}
          />
        </FormRow>
        <FormRow label="Division">
          <Select value={divisionId} onValueChange={setDivisionId}>
            <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No division</SelectItem>
              {divisions.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormRow>
      </FormSection>
    </FormShell>
  );
}

/* ------------------------------------------------------------------ */
/*  Bulk-add dialog                                                    */
/* ------------------------------------------------------------------ */

interface ResolvedRow {
  email: string;
  user_id: string;
  name: string;
  outcome: "added" | "already_active" | "reactivated";
}

interface DryRunReport {
  resolved: ResolvedRow[];
  unmatched: string[];
  added_count: number;
  reactivated_count: number;
  already_active_count: number;
  dry_run: boolean;
}

/**
 * Two-phase bulk import. Paste emails, run a server-side dry-run to
 * resolve everything, review the preview, then commit. The commit is
 * idempotent (removed memberships get reactivated; active ones are
 * left alone), so re-running is cheap.
 */
function BulkAddMembersDialog({
  league, seasonId, divisions, onDone,
}: {
  league: League;
  seasonId: string;
  divisions: LeagueDivision[];
  onDone: () => Promise<void>;
}) {
  const [raw, setRaw] = useState("");
  const [divisionId, setDivisionId] = useState<string | "none">("none");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<DryRunReport | null>(null);

  // Split the paste into a clean unique lowercased list — handles both
  // newlines and commas, ignores blanks, dedupes.
  const emails = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    raw.split(/[\n,;]/).forEach((chunk) => {
      const e = chunk.trim();
      if (!e) return;
      const key = e.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(e);
    });
    return out;
  }, [raw]);

  const runDryRun = async () => {
    if (emails.length === 0) { toast.error("Paste some emails first"); return; }
    setBusy(true);
    const { data, error } = await supabase.rpc(
      "bulk_add_league_members" as never,
      {
        p_league_id: league.id,
        p_season_id: seasonId,
        p_division_id: divisionId === "none" ? null : divisionId,
        p_emails: emails,
        p_dry_run: true,
      } as never,
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setPreview(data as unknown as DryRunReport);
  };

  const commit = async () => {
    if (!preview) return;
    setBusy(true);
    const { data, error } = await supabase.rpc(
      "bulk_add_league_members" as never,
      {
        p_league_id: league.id,
        p_season_id: seasonId,
        p_division_id: divisionId === "none" ? null : divisionId,
        p_emails: emails,
        p_dry_run: false,
      } as never,
    );
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const report = data as unknown as DryRunReport;
    const parts: string[] = [];
    if (report.added_count) parts.push(`${report.added_count} added`);
    if (report.reactivated_count) parts.push(`${report.reactivated_count} reactivated`);
    if (report.already_active_count) parts.push(`${report.already_active_count} already members`);
    toast.success(parts.length ? parts.join(" · ") : "Nothing changed");
    setPreview(null);
    setRaw("");
    await onDone();
  };

  const reset = () => setPreview(null);

  const groupOutcome = (o: ResolvedRow["outcome"]) =>
    preview?.resolved.filter((r) => r.outcome === o) ?? [];

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          Bulk add members
        </DialogTitle>
      </DialogHeader>

      {/* Phase 1 — paste + preview */}
      {!preview ? (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Emails</Label>
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={"one per line, or comma-separated\ne.g. alice@example.com\n     bob@example.com"}
              rows={6}
              className="font-mono text-sm"
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3 h-3" />
              Case-insensitive. Matches must be existing PULSE accounts.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Division (optional)</Label>
            <Select value={divisionId} onValueChange={setDivisionId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No division</SelectItem>
                {divisions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {emails.length > 0 && (
            <div className="text-[11px] text-muted-foreground">
              {emails.length} unique email{emails.length === 1 ? "" : "s"} ready to check
            </div>
          )}
          <DialogFooter>
            <Button
              onClick={runDryRun}
              disabled={busy || emails.length === 0}
              className="w-full"
            >
              {busy ? "Checking…" : `Preview ${emails.length > 0 ? emails.length : ""} match${emails.length === 1 ? "" : "es"}`}
            </Button>
          </DialogFooter>
        </div>
      ) : (
        // Phase 2 — review + commit
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Add" count={preview.added_count} tone="primary" icon={CheckCircle2} />
            <StatCard label="Reactivate" count={preview.reactivated_count} tone="amber" icon={RotateCw} />
            <StatCard label="Already in" count={preview.already_active_count} tone="muted" icon={Users} />
            <StatCard label="Unmatched" count={preview.unmatched.length} tone="destructive" icon={AlertCircle} />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-2 rounded-lg border border-border/60 bg-muted/20 p-2">
            <GroupSection
              title="Will be added" tone="text-primary"
              icon={CheckCircle2}
              rows={groupOutcome("added")}
            />
            <GroupSection
              title="Will be reactivated" tone="text-amber-600"
              icon={RotateCw}
              rows={groupOutcome("reactivated")}
            />
            <GroupSection
              title="Already active" tone="text-muted-foreground"
              icon={Users}
              rows={groupOutcome("already_active")}
            />
            {preview.unmatched.length > 0 && (
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-destructive mb-1 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  Not found ({preview.unmatched.length})
                </div>
                <ul className="text-xs font-mono space-y-0.5 pl-1">
                  {preview.unmatched.map((e) => (
                    <li key={e} className="text-muted-foreground line-through">
                      {e}
                    </li>
                  ))}
                </ul>
                <p className="text-[10px] text-muted-foreground mt-1 pl-1">
                  No PULSE account matches these. Ask them to sign up first.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={reset} disabled={busy}>
              Back
            </Button>
            <Button
              onClick={commit}
              disabled={busy || (preview.added_count + preview.reactivated_count === 0)}
              className="flex-1"
            >
              {busy
                ? "Committing…"
                : `Add ${preview.added_count + preview.reactivated_count} member${preview.added_count + preview.reactivated_count === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </div>
      )}
    </DialogContent>
  );
}

function StatCard({
  label, count, tone, icon: Icon,
}: {
  label: string;
  count: number;
  tone: "primary" | "amber" | "muted" | "destructive";
  icon: typeof CheckCircle2;
}) {
  const toneCls = {
    primary:     "bg-primary/10 text-primary",
    amber:       "bg-amber-500/10 text-amber-600",
    muted:       "bg-muted text-muted-foreground",
    destructive: "bg-destructive/10 text-destructive",
  }[tone];
  return (
    <div className={`rounded-lg p-2 flex items-center gap-2 ${toneCls}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <div className="min-w-0">
        <div className="text-lg font-bold leading-none tabular-nums">{count}</div>
        <div className="text-[9px] uppercase tracking-wider font-bold opacity-80">
          {label}
        </div>
      </div>
    </div>
  );
}

function GroupSection({
  title, tone, icon: Icon, rows,
}: {
  title: string;
  tone: string;
  icon: typeof CheckCircle2;
  rows: ResolvedRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <div>
      <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 flex items-center gap-1 ${tone}`}>
        <Icon className="w-3 h-3" />
        {title} ({rows.length})
      </div>
      <ul className="text-xs space-y-0.5 pl-1">
        {rows.map((r) => (
          <li key={r.email} className="flex items-baseline gap-1.5">
            <span className="font-medium truncate">{r.name}</span>
            <span className="text-[10px] font-mono text-muted-foreground truncate">
              {r.email}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
