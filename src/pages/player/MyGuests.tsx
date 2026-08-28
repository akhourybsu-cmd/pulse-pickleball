import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Check,
  Loader2,
  UserPlus,
  Search,
  Send,
  Link2,
  Trash2,
  GitMerge,
  X,
  Info,
  Users,
  UserCheck,
  Inbox,
} from "lucide-react";
import { GuestInviteDialog } from "@/components/round-robin/GuestInviteDialog";
import { GlassRowGroup } from "@/components/round-robin/PremiumDialogHeader";
import { PageSEO } from "@/components/seo/PageSEO";
import { withPulseActivity } from "@/components/ui/pulse-activity";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Guest = {
  id: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  linked_user_id: string | null;
  created_at: string;
  group_id: string | null;
};

export default function MyGuests() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [inviteGuest, setInviteGuest] = useState<Guest | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [removeTarget, setRemoveTarget] = useState<Guest | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  // Merge state
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergeConfirm, setMergeConfirm] = useState<{
    keep: Guest;
    remove: Guest;
  } | null>(null);
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const { data: allGuests = [], isLoading } = useQuery({
    queryKey: ["my-guest-players", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_players")
        .select("id, display_name, email, phone, linked_user_id, created_at, group_id")
        .eq("created_by", userId!)
        .order("display_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Guest[];
    },
  });

  // Once a guest claims a PULSE account they graduate off the roster —
  // they're a real player now and get picked from player search instead.
  // Their history stays intact on the linked record.
  const guests = useMemo(
    () => allGuests.filter((g) => !g.linked_user_id),
    [allGuests],
  );
  const linkedCount = allGuests.length - guests.length;

  // Pending guest claims awaiting the current user's (creator's) approval.
  // Without this UI, someone who signs up via a claim invite (with no
  // matching invited_email) gets stuck in "awaiting_approval" forever and
  // the guest → player merge never completes.
  const { data: pendingClaims = [] } = useQuery({
    queryKey: ["pending-guest-claims", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data: invites, error } = await supabase
        .from("guest_claim_invites")
        .select("id, guest_player_id, accepted_by_user_id, created_at")
        .eq("created_by", userId!)
        .eq("status", "awaiting_approval");
      if (error) throw error;
      const rows = invites ?? [];
      if (rows.length === 0) return [] as Array<{
        invite_id: string;
        guest_player_id: string;
        guest_name: string;
        claimant_id: string;
        claimant_name: string;
        claimant_email: string | null;
      }>;
      const guestIds = Array.from(new Set(rows.map((r) => r.guest_player_id)));
      const userIds = Array.from(
        new Set(rows.map((r) => r.accepted_by_user_id).filter(Boolean) as string[]),
      );
      const [{ data: gs }, { data: ps }] = await Promise.all([
        supabase.from("guest_players").select("id, display_name").in("id", guestIds),
        userIds.length
          ? supabase
              .from("profiles")
              .select("id, display_name, full_name, email")
              .in("id", userIds)
          : Promise.resolve({ data: [] as any[] } as any),
      ]);
      const gMap = new Map((gs ?? []).map((g: any) => [g.id, g.display_name]));
      const pMap = new Map((ps ?? []).map((p: any) => [p.id, p]));
      return rows
        .filter((r) => r.accepted_by_user_id)
        .map((r) => {
          const p = pMap.get(r.accepted_by_user_id!) as any;
          return {
            invite_id: r.id,
            guest_player_id: r.guest_player_id,
            guest_name: (gMap.get(r.guest_player_id) as string) ?? "Guest",
            claimant_id: r.accepted_by_user_id!,
            claimant_name: p?.display_name || p?.full_name || "New player",
            claimant_email: p?.email ?? null,
          };
        });
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["pending-guest-claims", userId] });
    qc.invalidateQueries({ queryKey: ["my-guest-players", userId] });
  };

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const approveClaim = async (inviteId: string) => {
    setApprovingId(inviteId);
    try {
      await withPulseActivity(
        "Linking guest to their account…",
        async () => {
          const { data, error } = await supabase.rpc("approve_guest_claim", {
            _invite_id: inviteId,
          });
          const res = (data ?? {}) as { ok?: boolean; error?: string };
          if (error || !res.ok) {
            throw new Error(error?.message || res.error || "Could not approve claim.");
          }
        },
        "Linked — removed from your guest list",
      );
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Could not approve claim.");
    } finally {
      setApprovingId(null);
    }
  };

  const rejectClaim = async (inviteId: string) => {
    const { error } = await supabase
      .from("guest_claim_invites")
      .update({ status: "revoked" })
      .eq("id", inviteId);
    setRejectTarget(null);
    if (error) {
      toast.error("Could not reject.");
      return;
    }
    refresh();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return guests;
    return guests.filter(
      (g) =>
        g.display_name.toLowerCase().includes(q) ||
        (g.email ?? "").toLowerCase().includes(q),
    );
  }, [guests, search]);

  const addGuest = async () => {
    const display = name.trim();
    if (!display || !userId) return;
    setCreating(true);
    try {
      await withPulseActivity(`Adding ${display}…`, async () => {
        const { error } = await supabase
          .from("guest_players")
          .insert({ display_name: display, created_by: userId } as never);
        if (error) throw error;
      });
      setName("");
      refresh();
    } catch {
      toast.error("Could not add guest.");
    } finally {
      setCreating(false);
    }
  };

  const removeGuest = async (g: Guest) => {
    setRemoveTarget(null);
    try {
      await withPulseActivity(`Removing ${g.display_name}…`, async () => {
        const { error } = await supabase.from("guest_players").delete().eq("id", g.id);
        if (error) throw error;
      });
      refresh();
    } catch {
      toast.error("Could not remove. They may still be linked to past round robins.");
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const exitMergeMode = () => {
    setMergeMode(false);
    setSelectedIds([]);
  };

  const beginMerge = () => {
    if (selectedIds.length !== 2) return;
    const a = guests.find((g) => g.id === selectedIds[0]);
    const b = guests.find((g) => g.id === selectedIds[1]);
    if (!a || !b) return;
    // Keep the older record when neither is linked.
    const keep = new Date(a.created_at) <= new Date(b.created_at) ? a : b;
    const remove = keep.id === a.id ? b : a;
    setMergeConfirm({ keep, remove });
  };

  const confirmMerge = async () => {
    if (!mergeConfirm) return;
    setMerging(true);
    try {
      // Param names must match the SQL function signature exactly
      // (merge_guest_players(_keep_id, _remove_id)) — PostgREST resolves
      // functions by named arguments.
      await withPulseActivity("Merging guests…", async () => {
        const { error } = await supabase.rpc("merge_guest_players", {
          _keep_id: mergeConfirm.keep.id,
          _remove_id: mergeConfirm.remove.id,
        } as never);
        if (error) throw error;
      }, `Merged into ${mergeConfirm.keep.display_name}`);
      setMergeConfirm(null);
      exitMergeMode();
      refresh();
    } catch (e: any) {
      toast.error(e?.message || "Merge failed.");
    } finally {
      setMerging(false);
    }
  };

  // Suggest duplicates (case-insensitive name match).
  const duplicateNames = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of guests) {
      const key = g.display_name.trim().toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, n]) => n > 1)
        .map(([k]) => k),
    );
  }, [guests]);

  return (
    <div className="min-h-screen bg-background">
      <PageSEO
        title="Guest Roster | PULSE"
        description="Manage your reusable guest players for round robins."
        path="/player/guests"
      />

      {/* Premium hero — ambient primary bloom, court-line texture,
          accent-ruled eyebrow, scoreboard tiles. */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/[0.10] via-primary/[0.03] to-background border-b border-border/50">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -left-16 h-56 w-56 rounded-full blur-3xl opacity-[0.18]"
          style={{ background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)" }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(115deg, hsl(var(--foreground)) 0px, hsl(var(--foreground)) 1px, transparent 1px, transparent 22px)",
          }}
        />

        <div className="relative container max-w-2xl mx-auto px-4 pt-5 pb-4 sm:pt-6 sm:pb-5">
          <div className="relative pl-3.5 min-w-0">
            <span
              aria-hidden
              className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full bg-gradient-to-b from-primary to-primary/25"
            />
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary/80 mb-1">
              Round Robin
            </div>
            <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-[-0.02em] leading-[1.05] text-foreground">
              Guest Roster
            </h1>
            <p className="mt-1 text-[12.5px] text-muted-foreground leading-snug">
              Reusable guests for casual & open play. They don't affect PULSE
              Ratings until they claim an account.
            </p>
          </div>

          <div className="mt-3.5 grid grid-cols-3 gap-2">
            <HeroStatTile icon={Users} label="Guests" value={String(guests.length)} />
            <HeroStatTile icon={Inbox} label="Pending" value={String(pendingClaims.length)} />
            <HeroStatTile icon={UserCheck} label="Claimed" value={String(linkedCount)} />
          </div>
        </div>
      </section>

      <main className="container max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Add + search */}
        <div className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm p-3 space-y-2.5 shadow-[0_8px_30px_-18px_hsl(var(--foreground)/0.25)]">
          <div className="flex gap-2">
            <Input
              placeholder="Add a guest by name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addGuest()}
              className="h-11"
            />
            <Button
              onClick={addGuest}
              disabled={creating || !name.trim()}
              className="h-11 px-4 gap-1.5 shadow-[0_2px_10px_-2px_hsl(var(--primary)/0.5)]"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Add</span>
            </Button>
          </div>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search guests"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
        </div>

        {/* Pending claims — organizer must approve before the guest → player link completes. */}
        {pendingClaims.length > 0 && (
          <div className="rounded-2xl border border-primary/35 bg-primary/[0.06] p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="h-8 w-8 rounded-xl flex items-center justify-center border border-primary/25 bg-primary/10 text-primary flex-shrink-0">
                <Inbox className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="text-[13px] font-bold tracking-tight">
                  Pending claims ({pendingClaims.length})
                </h2>
                <p className="text-[11.5px] text-muted-foreground leading-snug">
                  Approve to link their PULSE account — history merges over and
                  they leave your guest list.
                </p>
              </div>
            </div>
            <GlassRowGroup>
              {pendingClaims.map((c) => (
                <div key={c.invite_id} className="flex items-center gap-2.5 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13.5px] font-semibold truncate">
                      {c.claimant_name}
                    </p>
                    <p className="text-[11.5px] text-muted-foreground truncate">
                      wants to claim{" "}
                      <span className="font-medium text-foreground">
                        {c.guest_name}
                      </span>
                      {c.claimant_email && <> · {c.claimant_email}</>}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setRejectTarget(c.invite_id)}
                    disabled={approvingId === c.invite_id}
                    aria-label="Reject claim"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => approveClaim(c.invite_id)}
                    disabled={approvingId === c.invite_id}
                  >
                    {approvingId === c.invite_id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-3.5 w-3.5 mr-1" /> Approve
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </GlassRowGroup>
          </div>
        )}

        {/* Merge toolbar */}
        {guests.length >= 2 && (
          <div className="flex items-center justify-between gap-2">
            {mergeMode ? (
              <>
                <p className="text-[11.5px] text-muted-foreground">
                  Pick 2 guests to merge ({selectedIds.length}/2)
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={exitMergeMode}>
                    <X className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={beginMerge}
                    disabled={selectedIds.length !== 2}
                  >
                    <GitMerge className="h-3.5 w-3.5 mr-1" /> Merge
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-[11.5px] text-muted-foreground">
                  {duplicateNames.size > 0
                    ? `${duplicateNames.size} possible duplicate${duplicateNames.size === 1 ? "" : "s"} detected`
                    : "Tip: use Merge to combine duplicate guests"}
                </p>
                <div className="flex items-center gap-2">
                  <TooltipProvider delayDuration={100}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="About merging"
                        >
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <p className="text-xs">
                          <strong>What gets merged:</strong> All round-robin
                          appearances, stats, and claim invites from the removed
                          guest move to the kept guest.
                        </p>
                        <p className="text-xs mt-1 text-muted-foreground">
                          <strong>Why merge:</strong> Clean up accidental
                          duplicates so player history stays accurate.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button size="sm" variant="outline" onClick={() => setMergeMode(true)}>
                    <GitMerge className="h-3.5 w-3.5 mr-1" /> Merge duplicates
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-card/50 p-8 text-center">
            <span className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </span>
            <p className="text-[13.5px] font-semibold">
              {search ? "No guests match that search" : "No guests yet"}
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {search
                ? "Try a different name or email."
                : "Add one above — they'll be available in every future round robin."}
            </p>
          </div>
        ) : (
          <GlassRowGroup className="animate-fade-up">
            {filtered.map((g) => {
              const initials = g.display_name
                .split(" ")
                .map((s) => s[0])
                .filter(Boolean)
                .slice(0, 2)
                .join("")
                .toUpperCase();
              const isSelected = selectedIds.includes(g.id);
              const isDup = duplicateNames.has(g.display_name.trim().toLowerCase());
              return (
                <div
                  key={g.id}
                  className={cn(
                    "flex items-center gap-3 p-3 transition-colors",
                    mergeMode && "cursor-pointer hover:bg-muted/40",
                    mergeMode && isSelected && "bg-primary/[0.07]",
                  )}
                  onClick={mergeMode ? () => toggleSelected(g.id) : undefined}
                  role={mergeMode ? "button" : undefined}
                >
                  {mergeMode && (
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelected(g.id)}
                      aria-label={`Select ${g.display_name}`}
                    />
                  )}
                  <Avatar className="h-10 w-10 border border-border/60">
                    <AvatarFallback className="text-[12px] font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14px] font-semibold truncate">
                        {g.display_name}
                      </p>
                      <Badge variant="outline" className="text-[10px]">
                        Guest
                      </Badge>
                      {isDup && !mergeMode && (
                        <Badge
                          variant="outline"
                          className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400"
                        >
                          Possible duplicate
                        </Badge>
                      )}
                    </div>
                    {g.email && (
                      <p className="text-[11.5px] text-muted-foreground truncate">
                        {g.email}
                      </p>
                    )}
                  </div>
                  {!mergeMode && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setInviteGuest(g)}
                        className="h-9"
                      >
                        <Send className="h-3 w-3 sm:mr-1" />
                        <span className="hidden sm:inline">Invite</span>
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setRemoveTarget(g)}
                        aria-label={`Remove ${g.display_name}`}
                        className="h-9 w-9"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </GlassRowGroup>
        )}

        {linkedCount > 0 && (
          <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
            <Link2 className="h-3.5 w-3.5 text-primary/70" />
            {linkedCount} guest{linkedCount === 1 ? "" : "s"} claimed a PULSE
            account and moved off this list — search for them as players.
          </p>
        )}
      </main>

      {inviteGuest && (
        <GuestInviteDialog
          open={!!inviteGuest}
          onOpenChange={(o) => !o && setInviteGuest(null)}
          guestPlayerId={inviteGuest.id}
          guestDisplayName={inviteGuest.display_name}
          defaultEmail={inviteGuest.email}
        />
      )}

      {/* Remove guest */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this guest?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.display_name} will be taken off your roster. If they
              appear in past round robins, the removal will be blocked to protect
              that history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeTarget && removeGuest(removeTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject claim */}
      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this claim?</AlertDialogTitle>
            <AlertDialogDescription>
              The invite link becomes unusable and the guest stays on your roster.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectTarget && rejectClaim(rejectTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!mergeConfirm}
        onOpenChange={(o) => !o && setMergeConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge guests?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Keep{" "}
                  <span className="font-semibold text-foreground">
                    {mergeConfirm?.keep.display_name}
                  </span>{" "}
                  and remove{" "}
                  <span className="font-semibold text-foreground">
                    {mergeConfirm?.remove.display_name}
                  </span>
                  .
                </p>
                <p className="text-muted-foreground">
                  Every round robin where{" "}
                  <span className="font-medium">
                    {mergeConfirm?.remove.display_name}
                  </span>{" "}
                  appeared will be rewritten to use{" "}
                  <span className="font-medium">
                    {mergeConfirm?.keep.display_name}
                  </span>
                  . This can't be undone.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={merging}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMerge} disabled={merging}>
              {merging ? <Loader2 className="h-4 w-4 animate-spin" /> : "Merge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HeroStatTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Users;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/70 backdrop-blur-sm px-2.5 py-2 shadow-[0_1px_3px_hsl(var(--foreground)/0.04)]">
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
        <Icon className="h-3 w-3 text-primary/80" />
        {label}
      </div>
      <div className="mt-0.5 text-[15px] font-bold tracking-tight text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}
