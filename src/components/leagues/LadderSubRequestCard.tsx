import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { CalendarClock, UserX, CheckCircle2, Ban, Clock } from "lucide-react";

interface WeekShell {
  id: string;
  week_number: number;
  scheduled_date: string | null;
  start_time: string | null;
  location: string | null;
}
interface MyRequest {
  id: string;
  session_id: string;
  week_number: number;
  status: "pending" | "sub" | "sitout" | "declined" | "canceled";
}

/**
 * Player self-service: request a sub for an upcoming, scheduled ladder week
 * they can't make. Lists the player's existing requests (with cancel) and a
 * "Request a sub" action that picks from weeks that are scheduled but not yet
 * generated. Ladder leagues only.
 */
export function LadderSubRequestCard({
  leagueId, seasonId, currentUserId,
}: {
  leagueId: string;
  seasonId: string | null;
  currentUserId: string | null;
}) {
  const [weeks, setWeeks] = useState<WeekShell[]>([]);
  const [requests, setRequests] = useState<MyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [pickWeek, setPickWeek] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!seasonId || !currentUserId) { setLoading(false); return; }
    setLoading(true);
    const [sessRes, batchRes, reqRes] = await Promise.all([
      supabase.from("league_sessions" as never).select("id, week_number, scheduled_date, start_time, location")
        .eq("season_id", seasonId).not("week_number", "is", null)
        .order("week_number", { ascending: true }),
      supabase.from("ladder_batches" as never).select("week_number").eq("season_id", seasonId),
      supabase.from("ladder_sub_requests" as never)
        .select("id, session_id, week_number, status")
        .eq("season_id", seasonId).eq("player_id", currentUserId),
    ]);
    const generated = new Set(
      ((batchRes.data ?? []) as Array<{ week_number: number }>).map((b) => b.week_number),
    );
    const today = new Date().toISOString().slice(0, 10);
    // Requestable = week >= 2, not yet generated, and not already in the past.
    setWeeks(((sessRes.data ?? []) as unknown as WeekShell[]).filter((w) =>
      w.week_number >= 2
      && !generated.has(w.week_number)
      && (!w.scheduled_date || w.scheduled_date >= today)));
    setRequests((reqRes.data ?? []) as unknown as MyRequest[]);
    setLoading(false);
  }, [seasonId, currentUserId]);

  useEffect(() => { void load(); }, [load]);

  if (loading || !seasonId || !currentUserId) return null;

  const activeReqByWeek = new Map(
    requests.filter((r) => r.status !== "canceled").map((r) => [r.week_number, r]),
  );
  // Weeks the player can still request for (no active request yet).
  const openWeeks = weeks.filter((w) => !activeReqByWeek.has(w.week_number));
  const myActive = requests.filter((r) => r.status !== "canceled");

  // Nothing to schedule against and nothing outstanding → hide entirely.
  if (openWeeks.length === 0 && myActive.length === 0) return null;

  const fmt = (w: WeekShell) => {
    const d = w.scheduled_date
      ? new Date(`${w.scheduled_date}T00:00:00`).toLocaleDateString(undefined,
          { weekday: "short", month: "short", day: "numeric" })
      : "date TBD";
    return `Week ${w.week_number} · ${d}${w.start_time ? ` · ${w.start_time.slice(0, 5)}` : ""}`;
  };

  const statusMeta = (s: MyRequest["status"]) => {
    switch (s) {
      case "pending": return { icon: <Clock className="w-3.5 h-3.5" />, label: "Requested — awaiting organizer", cls: "text-amber-600 dark:text-amber-400" };
      case "sub": return { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Sub arranged", cls: "text-emerald-600 dark:text-emerald-400" };
      case "sitout": return { icon: <UserX className="w-3.5 h-3.5" />, label: "Sitting out (you keep your spot)", cls: "text-emerald-600 dark:text-emerald-400" };
      case "declined": return { icon: <Ban className="w-3.5 h-3.5" />, label: "Couldn't be arranged — please play", cls: "text-muted-foreground" };
      default: return { icon: null, label: s, cls: "text-muted-foreground" };
    }
  };

  const submit = async () => {
    if (!pickWeek) return;
    setBusy(true);
    const { error } = await supabase.rpc("request_ladder_sub" as never, {
      p_season_id: seasonId,
      p_session_id: pickWeek,
      p_note: note.trim() || null,
    } as never);
    setBusy(false);
    if (error) {
      toast.error((error as { message?: string }).message ?? "Couldn't send the request");
      return;
    }
    toast.success("Sub request sent to the organizer");
    setOpen(false); setPickWeek(null); setNote("");
    void load();
  };

  const cancel = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.rpc("cancel_ladder_sub_request" as never, {
      p_request_id: id,
    } as never);
    setBusy(false);
    if (error) {
      toast.error((error as { message?: string }).message ?? "Couldn't cancel");
      return;
    }
    void load();
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <CalendarClock className="w-3.5 h-3.5" />
          Can't make a week?
        </h2>
        {openWeeks.length > 0 && (
          <Button size="sm" variant="outline" className="h-9 text-xs"
            onClick={() => { setPickWeek(openWeeks[0].id); setOpen(true); }}>
            Request a sub
          </Button>
        )}
      </div>

      {myActive.length > 0 ? (
        <ul className="space-y-1.5">
          {myActive
            .sort((a, b) => a.week_number - b.week_number)
            .map((r) => {
              const m = statusMeta(r.status);
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 text-xs">
                  <span className="flex flex-wrap items-center gap-1.5 min-w-0 break-words">
                    <span className="font-semibold">Week {r.week_number}</span>
                    <span className={`inline-flex items-center gap-1 ${m.cls}`}>
                      {m.icon}{m.label}
                    </span>
                  </span>
                  {r.status === "pending" && (
                    <Button size="sm" variant="ghost" disabled={busy}
                      onClick={() => cancel(r.id)} className="h-9 text-xs text-muted-foreground shrink-0">
                      Cancel
                    </Button>
                  )}
                </li>
              );
            })}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">
          If you can't make an upcoming week, request a sub so the organizer can
          find a fill-in or hold your spot.
        </p>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setPickWeek(null); setNote(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Request a sub</DialogTitle>
            <DialogDescription>
              Pick the week you can't make. The organizer will find a fill-in or
              hold your spot — you keep your ladder position either way.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Week</div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {openWeeks.map((w) => (
                  <button key={w.id} type="button" onClick={() => setPickWeek(w.id)}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                      pickWeek === w.id
                        ? "border-primary bg-primary/5 font-semibold"
                        : "border-border/70 hover:border-primary/40"
                    }`}>
                    {fmt(w)}
                    {w.location ? <span className="text-muted-foreground"> · {w.location}</span> : null}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Note (optional)</div>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Anything the organizer should know?" rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={submit} disabled={!pickWeek || busy}
              className="font-bold uppercase tracking-wide">
              {busy ? "Sending…" : "Send request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
