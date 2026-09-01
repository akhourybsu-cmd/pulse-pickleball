import {
  ChevronLeft, ChevronRight, MoreHorizontal, Settings, Wrench, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { formatSlotTime, type CourtColumn } from '@/lib/venues/availability';
import { formatDuration, type CourtStatus, type DaySummary, type Gap } from '@/lib/venues/ops';
import { CourtStatusBoard } from './CourtStatusBoard';
import { OpsStatRail } from './OpsStatRail';
import { VenueBookingGrid } from '../VenueBookingGrid';

/**
 * The operations dashboard, as pure presentation.
 *
 * Split from the page so it can be rendered in the design harness with
 * realistic data — the layout problems here (a single column stretched across
 * a 1400px screen, a wall of identically-weighted boxes) are only visible when
 * you actually look at it, and it was not previously possible to.
 *
 * Layout follows the shape of the work rather than the shape of the data:
 * on a laptop the floor and the schedule are what an operator manipulates, so
 * they take the main column, while the day's numbers and the gaps worth
 * filling sit in a rail beside them where they can be glanced at without
 * scrolling. On a phone that rail simply falls underneath the floor, which is
 * the order of attention there anyway.
 */

export interface OpsDashboardProps {
  venueName: string;
  day: Date;
  now: Date;
  isToday: boolean;
  loading: boolean;
  closed: boolean;
  statuses: CourtStatus[];
  summary: DaySummary;
  gaps: Gap[];
  grid: CourtColumn[];
  accent?: string | null;
  canManage: boolean;
  onBack: () => void;
  onSettings: () => void;
  onCloseCourt: () => void;
  onPickCourt: (courtId: string) => void;
  onDayChange: (day: Date) => void;
  onPickSlot: (courtId: string, start: Date, minutes: number) => void;
  onPickSession: (sessionId: string) => void;
  onFillGap: (gap: Gap) => void;
}

export function OpsDashboard({
  venueName,
  day,
  now,
  isToday,
  loading,
  closed,
  statuses,
  summary,
  gaps,
  grid,
  accent,
  canManage,
  onBack,
  onSettings,
  onCloseCourt,
  onPickCourt,
  onDayChange,
  onPickSlot,
  onPickSession,
  onFillGap,
}: OpsDashboardProps) {
  return (
    <div className="min-h-[100dvh] bg-background pb-[env(safe-area-inset-bottom)]">
      {/* Toolbar. One slim row: where you are on the left, what you can do on
          the right. A chevron rather than a filled circle button — going back
          is not an action worth the visual weight of a control. */}
      <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-1 px-2 pt-[env(safe-area-inset-top)] sm:px-4">
          <button
            type="button"
            onClick={onBack}
            className="group flex h-9 shrink-0 items-center gap-0.5 rounded-lg pl-1 pr-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
            <span className="hidden sm:inline">Venue</span>
          </button>

          <div className="mx-1 hidden h-5 w-px shrink-0 bg-border sm:block" />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold leading-none">{venueName}</h1>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Operations
            </p>
          </div>

          {/* A live board deserves a live clock — it is also the quiet signal
              that what you're looking at is current. */}
          {isToday && (
            <span className="mr-1 hidden items-center gap-1.5 text-xs font-medium tabular-nums text-muted-foreground sm:flex">
              <span className="relative flex h-1.5 w-1.5">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60"
                  style={accent ? { backgroundColor: accent } : undefined}
                />
                <span
                  className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary"
                  style={accent ? { backgroundColor: accent } : undefined}
                />
              </span>
              {now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
            </span>
          )}

          <Button size="sm" className="h-9 shrink-0 rounded-lg px-3" onClick={onCloseCourt}>
            <Wrench className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Close court</span>
          </Button>

          {/* Secondary actions collapse rather than competing for the toolbar.
              A row of equal-weight buttons is what makes a header look
              generated; one primary action and an overflow does not. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 rounded-lg text-muted-foreground"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-[18px] w-[18px]" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={onCloseCourt}>
                <Wrench className="mr-2 h-4 w-4" />
                Close a court
              </DropdownMenuItem>
              {canManage && (
                <DropdownMenuItem onClick={onSettings}>
                  <Settings className="mr-2 h-4 w-4" />
                  Venue settings
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="mx-auto max-w-[1400px] px-4 py-5 sm:px-6">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_336px] lg:items-start lg:gap-6">
          {/* Main column: what an operator manipulates. */}
          <div className="min-w-0 space-y-7">
            <Section
              title={isToday ? 'On the floor' : 'Courts'}
              hint={
                isToday
                  ? undefined
                  : day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
              }
            >
              {loading ? (
                <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-[104px] rounded-xl" />
                  ))}
                </div>
              ) : (
                <CourtStatusBoard statuses={statuses} accent={accent} onPickCourt={onPickCourt} />
              )}
            </Section>

            {/* The rail's content on mobile, where there is no rail. */}
            <div className="space-y-7 lg:hidden">
              <DayPanel summary={summary} accent={accent} />
              <GapsPanel gaps={gaps} summary={summary} accent={accent} onFillGap={onFillGap} />
            </div>

            <Section title="Schedule">
              {closed ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
                  <p className="text-sm font-semibold">Closed on this day</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Change opening hours in venue settings.
                  </p>
                </div>
              ) : (
                <VenueBookingGrid
                  grid={grid}
                  day={day}
                  loading={loading}
                  canBook
                  accent={accent}
                  onDayChange={onDayChange}
                  onPickSlot={onPickSlot}
                  onPickSession={onPickSession}
                />
              )}
            </Section>
          </div>

          {/* Rail: what an operator glances at. Sticky, because it is reference
              material for the schedule you are scrolling beside it. */}
          <aside className="hidden lg:sticky lg:top-[4.5rem] lg:block lg:space-y-7">
            <DayPanel summary={summary} accent={accent} />
            <GapsPanel gaps={gaps} summary={summary} accent={accent} onFillGap={onFillGap} />
          </aside>
        </div>
      </div>
    </div>
  );
}

function DayPanel({ summary, accent }: { summary: DaySummary; accent?: string | null }) {
  return (
    <Section title="The day">
      <OpsStatRail summary={summary} accent={accent} />
    </Section>
  );
}

function GapsPanel({
  gaps,
  summary,
  accent,
  onFillGap,
}: {
  gaps: Gap[];
  summary: DaySummary;
  accent?: string | null;
  onFillGap: (gap: Gap) => void;
}) {
  if (gaps.length === 0) return null;

  return (
    <Section title="Sellable gaps" hint={`${formatDuration(summary.openMinutes)} open`}>
      {/* Hairline-divided rows in one panel, not a stack of bordered cards.
          Four cards in a column read as four separate things; this reads as
          one list, which is what it is. */}
      <div className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-card">
        {gaps.map((gap) => (
          <button
            key={`${gap.court.id}-${gap.start.toISOString()}`}
            type="button"
            onClick={() => onFillGap(gap)}
            className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {gap.court.name ?? `Court ${gap.court.court_number}`}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatSlotTime(gap.start)} – {formatSlotTime(gap.end)}
              </p>
            </div>
            <span
              className="shrink-0 text-sm font-bold tabular-nums"
              style={accent ? { color: accent } : undefined}
            >
              {formatDuration(gap.minutes)}
            </span>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
              <Plus className="h-3.5 w-3.5" />
            </span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Longest unbooked stretches left today.
      </p>
    </Section>
  );
}

/**
 * A heading and its content.
 *
 * The label is small and the rule carries the width, so sections are separated
 * by structure rather than by wrapping everything in another bordered box —
 * boxes inside boxes is most of what makes a dashboard look assembled instead
 * of designed.
 */
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-3">
        <h2 className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {title}
        </h2>
        <span aria-hidden className="h-px flex-1 bg-border/70" />
        {hint && (
          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{hint}</span>
        )}
      </div>
      {children}
    </section>
  );
}
