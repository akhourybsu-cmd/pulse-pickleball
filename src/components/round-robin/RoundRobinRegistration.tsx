import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle2, Clock3, Copy, Loader2, MapPin, Share2, Trophy, Users } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { stashPostAuthRedirect } from "@/lib/authRedirect";
import { copyRoundRobinLink, roundRobinJoinAction, roundRobinPath, shareRoundRobin } from "@/lib/roundRobin/sharing";
import { useRoundRobinEntry } from "@/hooks/useRoundRobinEntry";
import { toast } from "sonner";

export function RoundRobinRegistration({ entry, eventId, inviteCode, onJoined }: {
  entry: ReturnType<typeof useRoundRobinEntry>; eventId: string; inviteCode?: string | null; onJoined?: () => void;
}) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const event = entry.data;
  const path = roundRobinPath(eventId, inviteCode);
  if (entry.auth.loading || entry.isPending) return <div role="status" className="p-10 text-center"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />Loading event…</div>;
  if (entry.isError) return <div role="alert" className="space-y-4 p-6 text-center"><h1 className="text-xl font-semibold">Let’s reconnect to this event</h1><p className="text-sm text-muted-foreground">The event could not load. Please try again.</p><Button onClick={() => void entry.refetch()}>Retry</Button></div>;
  const signIn = () => {
    stashPostAuthRedirect(path);
    navigate(`/auth?${new URLSearchParams({ redirect: path })}`, { state: { returnTo: path } });
  };
  if (!event) return <div className="space-y-4 p-6 text-center">
    <Trophy className="mx-auto h-10 w-10 text-primary" />
    <h1 className="text-xl font-semibold">Have an invitation?</h1>
    <p className="text-sm text-muted-foreground">This event may be private, or the link may be outdated. Enter the host’s invite code or sign in with your registered account.</p>
    <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (code.trim()) navigate(roundRobinPath(eventId, code)); }}>
      <Input aria-label="Invite code" placeholder="Invite code" value={code} maxLength={20} onChange={e => setCode(e.target.value)} />
      <Button disabled={!code.trim()} type="submit">View Event</Button>
    </form>
    {inviteCode && <p role="alert" className="text-sm text-destructive">That invitation did not open this event. Ask the host for a new link.</p>}
    {!entry.auth.isAuthenticated && <Button variant="outline" onClick={signIn}>Sign in</Button>}
  </div>;

  const action = roundRobinJoinAction(event);
  const date = parseISO(`${event.date}T${event.start_time || "00:00:00"}`);
  const registered = event.registration_status === "confirmed";
  const waitlisted = event.registration_status === "waitlisted";
  const join = async () => {
    if (!entry.auth.isAuthenticated) { signIn(); return; }
    if (event.can_open) { navigate(path); onJoined?.(); return; }
    if (event.venue_registration_path) { navigate(event.venue_registration_path); onJoined?.(); return; }
    setJoining(true); setJoinError(null);
    try {
      const { data, error } = await supabase.rpc("join_round_robin_event", { p_event_id: eventId, p_invite_code: inviteCode || undefined });
      if (error) throw error;
      const result = data as { registration_status: string; message: string };
      toast.success(result.message);
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["available-round-robin-events"] }),
        cache.invalidateQueries({ queryKey: ["event-registrations", eventId] }),
        cache.invalidateQueries({ queryKey: ["round-robin-entry", eventId] }),
      ]);
      if (result.registration_status === "confirmed") { navigate(path); onJoined?.(); }
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : (error as { message?: string })?.message || "Registration could not be saved. Please try again.");
      void entry.refetch();
    } finally { setJoining(false); }
  };
  const share = async (copy: boolean) => {
    try {
      if (copy) { await copyRoundRobinLink(eventId, inviteCode); toast.success("Event link copied"); }
      else if (await shareRoundRobin(eventId, event.name, inviteCode) === "copied") toast.success("Event link copied");
    } catch { toast.error("Could not copy the link. You can copy it from the address bar."); }
  };
  return <article className="overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-black/5">
    <div className="relative border-b bg-gradient-to-br from-primary/15 via-primary/5 to-card p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary"><Trophy className="h-4 w-4" />PULSE Round Robin</div>
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{event.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Hosted by {event.organizer_name || "your organizer"}</p>
      <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary" />{isValid(date) ? format(date, "EEEE, MMMM d, yyyy") : event.date}</div>
        <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-primary" />{event.start_time && isValid(date) ? `${format(date, "h:mm a")} · event local time` : "Time to be announced"}</div>
        {event.location && <div className="flex items-start gap-2 sm:col-span-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{event.location}</div>}
      </div>
    </div>
    <div className="space-y-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-muted/40 p-4">
        <div><p className="flex items-center gap-2 font-semibold"><Users className="h-4 w-4 text-primary" />{event.confirmed_count}{event.max_players !== null ? ` / ${event.max_players}` : ""} registered</p><p className="mt-1 text-xs text-muted-foreground">{event.num_courts} courts · {event.num_rounds} rounds{event.waitlisted_count > 0 ? ` · ${event.waitlisted_count} on the waitlist` : ""}</p></div>
        {event.max_players !== null && <span className="text-sm font-semibold text-primary">{Math.max(0, event.max_players - event.confirmed_count)} spots open</span>}
      </div>
      {event.notes && <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{event.notes}</p>}
      {(registered || waitlisted) && <div role="status" className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4"><CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="font-semibold">{waitlisted ? "You're on the waitlist" : "You're registered"}</p><p className="mt-1 text-sm text-muted-foreground">{waitlisted ? `Your place is saved${event.waitlist_position ? ` · position ${event.waitlist_position}` : ""}. A waitlist place is not a confirmed playing spot.` : "Your place in this event is confirmed."}</p></div></div>}
      {event.closed_reason && !registered && !waitlisted && <p className="text-sm text-muted-foreground">{event.closed_reason}</p>}
      {joinError && <p role="alert" className="text-sm text-destructive">{joinError}</p>}
      <div className="space-y-3">
        {event.price_cents != null && event.price_cents > 0 && <p className="text-sm font-semibold">{new Intl.NumberFormat("en-US", { style: "currency", currency: event.currency || "USD" }).format(event.price_cents / 100)} per player</p>}
        <Button size="lg" className="h-12 w-full text-base" disabled={joining || action.disabled} onClick={() => void join()}>{joining && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{joining ? "Saving your place…" : action.label}</Button>
        {!entry.auth.isAuthenticated && !action.disabled && <p className="text-center text-xs text-muted-foreground">Sign in or create a free PULSE account to continue. We’ll bring you back to this event.</p>}
        {event.venue_registration_path && !event.can_open && <p className="text-center text-xs text-muted-foreground">Complete registration, payment and any waiver through the venue.</p>}
      </div>
      <div className="flex gap-3 border-t pt-5"><Button variant="outline" className="flex-1 gap-2" onClick={() => void share(false)}><Share2 className="h-4 w-4" />Share Event</Button><Button variant="outline" className="flex-1 gap-2" onClick={() => void share(true)}><Copy className="h-4 w-4" />Copy Link</Button></div>
    </div>
  </article>;
}
