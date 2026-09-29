import { VenueAdminPageContext } from "@/components/venue/VenueAdminPageHeader";
import VenuePlayers from "./VenuePlayers";
import VenueWalkins from "./VenueWalkins";
import VenueDesk from "./VenueDesk";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuthState } from "@/hooks/useAuthState";
import { VenueOpsHeader } from "@/components/venue/ops/VenueOpsHeader";
import { AttendanceDesk } from "@/components/venue/ops/AttendanceDesk";
import { useVenueAttendance } from "@/hooks/useVenueAttendance";
import { parseVenueDay, venueDayKey } from "@/lib/venues/navigation";
import { VenueTheme } from "@/components/venue/VenueTheme";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { formatInTimeZone } from "date-fns-tz";
import { useGroupDetail } from "@/hooks/useGroupDetail";
import { useVenueModules } from "@/hooks/useVenueModules";
import { useVenueDay } from "@/hooks/useVenueDay";
import { venueCalendarNow } from "@/lib/venues/timezone";
import { venueChrome } from "@/lib/venues/branding";
import { parseVenueHours, venueOperatingBounds } from "@/lib/venues/hours";
import {
  useMyVenueRole,
  canOperateVenue,
  canManageVenue,
} from "@/components/venue/VenueStaffContext";
import { courtStatuses, daySummary, upcomingGaps } from "@/lib/venues/ops";
import { OpsDashboard } from "@/components/venue/ops/OpsDashboard";
import { CloseCourtDialog } from "@/components/venue/ops/CloseCourtDialog";
import { SessionSheet } from "@/components/venue/ops/SessionSheet";
import { BookCourtDialog } from "@/components/venue/BookCourtDialog";
import { VenueLoadState } from "@/components/venue/VenueLoadState";
import { availableBookingEnd } from "@/lib/venues/experience";

/**
 * Venue operations.
 *
 * Reads the same `useVenueDay` as the player-facing venue page, so the two can
 * never disagree about what is happening at the venue. What differs is
 * authority, not information: staff see closed courts, can act on occupied
 * slots, and can take a court out of play.
 *
 * The order of the page is the order of a manager's attention — the floor right
 * now, then the day's shape, then the whole timeline. Built to be usable on a
 * phone while walking the courts, because that is where this job is actually
 * done.
 */
export default function VenueOps() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthState();

  const {
    group,
    membership,
    loading,
    isError: groupError,
    refetch: refetchGroup,
  } = useGroupDetail(groupId);
  const modules = useVenueModules(group?.venue_id);
  const [params, setParams] = useSearchParams();
  const [deskTool, setDeskTool] = useState<
    "walkins" | "payments" | "players" | null
  >(null);
  const [deskPlayer, setDeskPlayer] = useState<string | undefined>();
  const openDeskTool = (
    tool: "walkins" | "players" | "payments",
    player?: string,
  ) => {
    setDeskPlayer(player);
    setDeskTool(tool);
  };
  const kiosk = params.get("kiosk") === "1";
  const deskView = params.get("view") === "courts" ? "courts" : "attendance";
  const setDeskView = (view: "attendance" | "courts") => {
    const p = new URLSearchParams(params);
    p.set("view", view);
    setParams(p, { replace: true });
  };
  const day =
    parseVenueDay(params.get("day")) ??
    venueCalendarNow(group?.venue?.timezone);
  day.setHours(0, 0, 0, 0);
  const setDay = (next: Date) => {
    const p = new URLSearchParams(params);
    p.set("day", venueDayKey(next));
    p.delete("event");
    setParams(p);
  };
  const selectEvent = (id: string) => {
    const p = new URLSearchParams(params);
    p.set("event", id);
    p.set("view", "attendance");
    setParams(p, { replace: true });
  };
  const toggleKiosk = () => {
    const p = new URLSearchParams(params);
    if (kiosk) {
      p.delete("kiosk");
      if (document.fullscreenElement)
        void document.exitFullscreen().catch(() => {});
    } else {
      p.set("kiosk", "1");
      void document.documentElement.requestFullscreen?.().catch(() => {});
    }
    setParams(p, { replace: true });
  };

  // The board is a clock: without this it would silently go stale and show a
  // court as in play twenty minutes after it emptied.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const [closeOpen, setCloseOpen] = useState(false);
  const [closeCourtId, setCloseCourtId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bookCourtId, setBookCourtId] = useState<string | null>(null);
  const [bookStart, setBookStart] = useState<Date | null>(null);
  const [bookMinutes, setBookMinutes] = useState<number | null>(null);

  const venue = group?.venue ?? null;
  const chrome = useMemo(() => venueChrome(venue), [venue]);
  const hours = useMemo(
    () => parseVenueHours(venue?.hours_of_operation),
    [venue],
  );

  const {
    role: venueRole,
    loading: roleLoading,
    error: roleError,
    refetch: refetchRole,
  } = useMyVenueRole(group?.venue_id);

  const {
    courts,
    sessions,
    holds,
    grid,
    closed,
    slotMinutes,
    loading: dayLoading,
    error: dayError,
    refresh,
  } = useVenueDay(group?.venue_id, groupId, day, hours, venue?.timezone);

  // Access is a venue role, not community moderation: a front-desk person can
  // run the day without being handed moderator powers over the conversation.
  // The group owner keeps access as a floor so a venue can never lock itself
  // out of its own operations.
  const isOwner =
    (membership?.status === "active" && membership.role === "owner") ||
    (!!user && group?.venue?.owner_id === user.id);
  const isStaff = modules.facility && (canOperateVenue(venueRole) || isOwner);
  const canDesk =
    (!!user && venue?.owner_id === user.id) ||
    canManageVenue(venueRole) ||
    (modules.facility && venueRole === "staff");
  const canCreateProgram =
    venueRole === "owner" ||
    venueRole === "manager" ||
    venueRole === "organizer" ||
    isOwner;

  const attendance = useVenueAttendance(groupId, venueDayKey(day), isStaff);
  const operatingWindow = useMemo(
    () => venueOperatingBounds(hours, day, venue?.timezone),
    [hours, day, venue?.timezone],
  );
  const occupancy = useMemo(() => [...sessions, ...holds], [sessions, holds]);
  const statuses = useMemo(
    () => courtStatuses(courts, occupancy, now, operatingWindow),
    [courts, occupancy, now, operatingWindow],
  );
  const summary = useMemo(
    () => daySummary(grid, statuses, now),
    [grid, statuses, now],
  );
  const gaps = useMemo(
    () => upcomingGaps(grid, now, 60).slice(0, 4),
    [grid, now],
  );

  const isToday =
    day.toDateString() ===
    venueCalendarNow(venue?.timezone, now).toDateString();

  // Non-staff must never see the operations view, even by URL.
  useEffect(() => {
    // Wait for the role to resolve, or a staff member is bounced on first paint.
    if (
      !loading &&
      !roleLoading &&
      !roleError &&
      !modules.loading &&
      !modules.isError &&
      group &&
      !isStaff
    ) {
      navigate(`/player/community/group/${groupId}`, { replace: true });
    }
  }, [
    loading,
    roleLoading,
    roleError,
    modules.loading,
    modules.isError,
    group,
    isStaff,
    groupId,
    navigate,
  ]);

  if (!loading && (groupError || !group))
    return <VenueLoadState fullPage onRetry={() => void refetchGroup()} />;
  if (modules.isError)
    return (
      <VenueLoadState
        fullPage
        title="Venue tools couldn’t load"
        onRetry={() => void modules.refetch()}
      />
    );
  if (roleError)
    return (
      <VenueLoadState
        fullPage
        title="Staff access couldn’t be checked"
        onRetry={() => void refetchRole()}
      />
    );

  if (loading || roleLoading || !group || !isStaff) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (dayError)
    return (
      <VenueLoadState
        fullPage
        title="Court schedule couldn’t load"
        description="Availability has not been confirmed. Retry before making changes to the schedule."
        onRetry={refresh}
      />
    );

  const selectedSession = occupancy.find((s) => s.id === sessionId) ?? null;
  const selectedSessionCourt =
    courts.find((c) => c.id === selectedSession?.venue_court_id) ?? null;
  const bookCourt = courts.find((c) => c.id === bookCourtId) ?? null;
  const dayStart = operatingWindow?.start ?? null;
  const dayEnd = operatingWindow?.end ?? null;
  const bookingEnd = availableBookingEnd(grid, bookCourtId, bookStart);
  const manageEvent = (start?: Date, end?: Date, court?: string) => {
    const params = new URLSearchParams({ new: "1" });
    if (start) params.set("start", start.toISOString());
    if (end) params.set("end", end.toISOString());
    if (court) params.set("court", court);
    navigate(`/player/community/group/${groupId}/events/manage?${params}`);
  };
  const openSlot = (courtId: string, start: Date, minutes = slotMinutes) => {
    if (modules.booking && canDesk) {
      const p = new URLSearchParams({
        court: courtId,
        day: venueDayKey(day),
        start: formatInTimeZone(
          start,
          venue?.timezone || "America/New_York",
          "yyyy-MM-dd'T'HH:mm",
        ),
        minutes: String(minutes),
      });
      navigate(`/player/community/group/${groupId}/walk-ins?${p}`);
    } else if (modules.booking) {
      setBookCourtId(courtId);
      setBookStart(start);
      setBookMinutes(minutes);
    } else if (canCreateProgram) {
      manageEvent(start, new Date(start.getTime() + minutes * 60_000), courtId);
    }
  };

  return (
    <VenueTheme brand={venue}>
      <VenueOpsHeader
        identity={{
          name: venue?.name ?? group.name,
          logoUrl: venue?.logo_url ?? group.icon_url,
          logoShape: venue?.logo_shape,
          logoImageFit: venue?.logo_image_fit,
          secondaryColor: venue?.secondary_color,
          logoBackgroundColor: venue?.logo_background_color,
        }}
        timeZone={venue?.timezone}
        now={now}
        kiosk={kiosk}
        view={deskView}
        onViewChange={setDeskView}
        onToggleKiosk={toggleKiosk}
      />
      {canDesk && (
        <nav
          aria-label="Daily desk shortcuts"
          className="flex flex-wrap gap-2 px-4 py-3"
        >
          <Button variant="outline" onClick={() => openDeskTool("walkins")}>
            Walk-ins & guest check-in
          </Button>
          <Button variant="outline" onClick={() => openDeskTool("players")}>
            Players & waivers
          </Button>
          <Button variant="outline" onClick={() => openDeskTool("payments")}>
            Collect payment
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              navigate(`/player/community/group/${groupId}/check-in-stations`)
            }
          >
            Player QR station
          </Button>
        </nav>
      )}
      <div
        className={
          kiosk ? "mx-auto max-w-[1680px] p-4 sm:p-6 lg:p-8" : undefined
        }
      >
        {deskView === "attendance" && (
          <AttendanceDesk
            data={attendance.data}
            day={day}
            timeZone={venue?.timezone}
            loading={attendance.isLoading}
            failed={attendance.isError}
            refreshing={attendance.isFetching}
            updatedAt={attendance.dataUpdatedAt}
            selectedId={params.get("event")}
            onSelect={selectEvent}
            onDayChange={setDay}
            onRefresh={attendance.refresh}
            kiosk={kiosk}
          />
        )}
        {deskView === "courts" && (
          <OpsDashboard
            embedded
            kiosk={kiosk}
            timeZone={venue?.timezone}
            venueName={venue?.name ?? group.name}
            day={day}
            now={now}
            isToday={isToday}
            loading={dayLoading}
            closed={closed}
            statuses={statuses}
            summary={summary}
            gaps={gaps}
            grid={grid}
            accent={chrome?.accentHex}
            canManage={canManageVenue(venueRole) || isOwner}
            canCreateProgram={canCreateProgram}
            canScheduleSlot={modules.booking || canCreateProgram}
            onBack={() => navigate(`/player/community/group/${groupId}`)}
            onSettings={() =>
              navigate(`/player/community/group/${groupId}/manage`)
            }
            onCloseCourt={() => {
              setCloseCourtId(null);
              setCloseOpen(true);
            }}
            onCreateProgram={() =>
              navigate(`/player/community/group/${groupId}/events/manage`)
            }
            onPickCourt={(courtId) => {
              const status = statuses.find((s) => s.court.id === courtId);
              // Tapping a live court goes to what's on it; tapping a free one is a
              // request to put something there.
              if (status?.current) {
                const session = sessions.find(
                  (s) => s.id === status.current!.id,
                );
                if (session?.venue_appointment_id && canDesk) {
                  navigate(
                    `/player/community/group/${groupId}/appointments?day=${venueDayKey(
                      day,
                    )}`,
                  );
                } else if (
                  (session?.venue_visit_id ||
                    session?.event_format === "reservation") &&
                  canDesk
                ) {
                  navigate(
                    `/player/community/group/${groupId}/walk-ins?day=${venueDayKey(
                      day,
                    )}`,
                  );
                } else if (session?.parent_event_id) {
                  selectEvent(session.parent_event_id);
                } else setSessionId(status.current.id);
              } else {
                const nextSlot = grid
                  .find((c) => c.court.id === courtId)
                  ?.slots.find((s) => s.bookable);
                if (nextSlot) {
                  openSlot(courtId, nextSlot.start);
                }
              }
            }}
            onDayChange={setDay}
            onPickSlot={openSlot}
            onPickSession={(id) => {
              const session = sessions.find((s) => s.id === id);
              const eventId =
                session?.parent_event_id ??
                (session?.event_format !== "reservation" &&
                session?.event_format !== "maintenance"
                  ? session?.id
                  : null);
              if (session?.venue_appointment_id && canDesk) {
                navigate(
                  `/player/community/group/${groupId}/appointments?day=${venueDayKey(
                    day,
                  )}`,
                );
              } else if (
                (session?.venue_visit_id ||
                  session?.event_format === "reservation") &&
                canDesk
              ) {
                navigate(
                  `/player/community/group/${groupId}/walk-ins?day=${venueDayKey(
                    day,
                  )}`,
                );
              } else if (eventId) {
                selectEvent(eventId);
              } else setSessionId(id);
            }}
            onFillGap={(gap) => {
              if (canCreateProgram) {
                manageEvent(gap.start, gap.end, gap.court.id);
              } else {
                openSlot(gap.court.id, gap.start);
              }
            }}
          />
        )}
      </div>
      {group.venue_id && (
        <>
          <CloseCourtDialog
            timeZone={venue?.timezone}
            open={closeOpen}
            onOpenChange={setCloseOpen}
            groupId={groupId!}
            venueId={group.venue_id}
            court={courts.find((c) => c.id === closeCourtId) ?? null}
            courts={courts}
            dayStart={dayStart}
            dayEnd={dayEnd}
            onClosed={refresh}
          />

          <BookCourtDialog
            timeZone={venue?.timezone}
            open={!!bookCourtId && !!bookStart}
            onOpenChange={(o) => {
              if (!o) {
                setBookCourtId(null);
                setBookStart(null);
                setBookMinutes(null);
              }
            }}
            groupId={groupId!}
            venueId={group.venue_id}
            court={bookCourt}
            start={bookStart}
            slotMinutes={slotMinutes}
            presetMinutes={bookMinutes}
            dayEnd={bookingEnd}
            onBooked={refresh}
          />
        </>
      )}

      <SessionSheet
        onManageEvent={
          canCreateProgram
            ? (id) =>
                navigate(
                  `/player/community/group/${groupId}/events/manage?event=${id}`,
                )
            : undefined
        }
        session={selectedSession}
        court={selectedSessionCourt}
        open={!!selectedSession}
        onOpenChange={(o) => {
          if (!o) setSessionId(null);
        }}
        onChanged={refresh}
      />
      {canDesk && deskTool && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) {
              setDeskTool(null);
              void attendance.refresh();
              refresh();
            }
          }}
        >
          <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-6xl">
            <DialogHeader>
              <DialogTitle>
                {deskTool === "walkins"
                  ? "Walk-ins & rentals"
                  : deskTool === "players"
                    ? "Players & waivers"
                    : "Front-desk payments"}
              </DialogTitle>
              <DialogDescription>
                Complete this task, then close to return to the same operations
                kiosk.
              </DialogDescription>
            </DialogHeader>
            <VenueAdminPageContext.Provider value={null}>
              {deskTool === "walkins" ? (
                <VenueWalkins
                  key={deskPlayer}
                  embedded
                  initialPlayer={deskPlayer}
                  onOpenPlayers={(id) => openDeskTool("players", id)}
                  onOpenDesk={(id) => openDeskTool("payments", id)}
                  onClose={() => setDeskTool(null)}
                />
              ) : deskTool === "players" ? (
                <VenuePlayers
                  key={deskPlayer}
                  embedded
                  initialPlayer={deskPlayer}
                  onOpenDesk={(id) => openDeskTool("payments", id)}
                />
              ) : (
                <VenueDesk
                  key={deskPlayer}
                  embedded
                  initialPlayer={deskPlayer}
                  onOpenPlayers={(id) => openDeskTool("players", id)}
                />
              )}
            </VenueAdminPageContext.Provider>
          </DialogContent>
        </Dialog>
      )}
    </VenueTheme>
  );
}
