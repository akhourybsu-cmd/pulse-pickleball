import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  CalendarDays,
  Gauge,
  LayoutGrid,
  MessageCircle,
  MessageSquareText,
  Palette,
  ShieldCheck,
  UsersRound,
  ListChecks,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchVenueAdminCounts, venueNextSteps, type VenueAdminCounts, type VenueNextStep } from '@/lib/venues/adminOverview';
export type { VenueAdminCounts } from '@/lib/venues/adminOverview';

export function VenueAdminOverview({
  venueId,
  groupId,
  venueName,
  memberCount,
  accent,
  canManageCommunity,
  chatEnabled,
  bookingEnabled = true,
  operationsEnabled = true,
  countsOverride,
  onOpenTab,
  onOperations,
  onOpenVenueTab,
  onMembers,
  onVerification,
  verified = true,
  isOwner = false,
  contactReady = true,
  privateSample = false,
  accessLoading = false,
  accessError = false,
  onRetryAccess,
  viewerId,
}: {
  venueId: string;
  groupId: string;
  venueName: string;
  memberCount: number;
  accent?: string | null;
  canManageCommunity: boolean;
  chatEnabled: boolean;
  bookingEnabled?: boolean;
  operationsEnabled?: boolean;
  countsOverride?: VenueAdminCounts;
  onOpenTab: (tab: string) => void;
  onOperations: () => void;
  onOpenVenueTab: (tab: 'home' | 'book' | 'play' | 'feed' | 'chat' | 'more') => void;
  onMembers?: () => void;
  onVerification?: () => void;
  verified?: boolean;
  isOwner?: boolean;
  contactReady?: boolean;
  privateSample?: boolean;
  accessLoading?: boolean;
  accessError?: boolean;
  onRetryAccess?: () => void;
  viewerId?: string | null;
}) {
  const summary = useQuery({
    queryKey: ['venue-admin-counts', venueId, groupId, viewerId, canManageCommunity],
    enabled: !countsOverride,
    staleTime: 0,
    refetchInterval: 60_000,
    queryFn: () => fetchVenueAdminCounts(venueId, groupId, canManageCommunity),
  });
  const counts = countsOverride ?? (summary.isError ? undefined : summary.data);
  const accessKnown = !accessLoading && !accessError;
  const hasFacility = accessKnown && (bookingEnabled || operationsEnabled);
  const steps = venueNextSteps({ counts, verified, isOwner, canManageCommunity, facilityEnabled: hasFacility, contactReady: counts?.contactReady ?? contactReady, privateSample });
  const handleStep = (step: VenueNextStep) => {
    if (step.action === 'members') onMembers?.();
    else if (step.action === 'verify') onVerification?.();
    else if (step.action === 'play') onOpenVenueTab('play');
    else onOpenTab(step.action);
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[24px] bg-[#191b20] p-5 text-white shadow-[0_24px_70px_-48px_rgba(0,0,0,0.7)] sm:p-7">
        <div
          aria-hidden
          className="absolute -right-16 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: accent ?? 'hsl(var(--primary))' }}
        />
        <div className="relative max-w-2xl">
          <p className="text-xs font-medium text-white/70">Venue overview</p>
          <h2 className="mt-2 break-words text-2xl font-semibold tracking-[-0.025em] sm:text-3xl">Your venue, at a glance.</h2>
          <p className="mt-2 max-w-xl break-words text-sm leading-6 text-white/60">
            Manage {venueName}’s community, keep players informed, and find the next thing that needs your attention.
          </p>
          {hasFacility && <button
            type="button"
            onClick={operationsEnabled ? onOperations : () => onOpenVenueTab('book')}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-[#15171b] transition-transform hover:-translate-y-0.5 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
            style={{ backgroundColor: accent ?? 'hsl(var(--primary))' }}
          >
            <Gauge className="h-4 w-4" /> {operationsEnabled ? 'Open live operations' : 'View court booking'}
          </button>}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Active courts" value={counts?.courts ?? null} icon={LayoutGrid} accent={accent} />
        <Metric label="Venue staff" value={counts?.staff ?? null} icon={ShieldCheck} accent={accent} />
        <Metric label="Upcoming programs" value={counts?.upcoming ?? null} icon={CalendarDays} accent={accent} />
        <Metric label="Members" value={counts ? counts.members ?? memberCount : null} icon={UsersRound} accent={accent} />
      </section>

      {!countsOverride && summary.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 text-sm"><p>We couldn’t load the venue totals. Your management tools are still available.</p><button type="button" onClick={() => void summary.refetch()} className="min-h-11 rounded-lg px-3 font-semibold underline underline-offset-4">Retry totals</button></div>}

      <section aria-labelledby="venue-next-steps" className="rounded-2xl border border-border/70 bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2"><ListChecks className="h-5 w-5 shrink-0 text-primary" /><h3 id="venue-next-steps" className="text-base font-semibold">Next steps</h3></div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">Requests and useful setup reminders. Optional paid features are never required to run your community.</p>
        {!counts && <p role="status" className="mt-3 text-sm text-muted-foreground">{summary.isError ? 'Some checks are unavailable until venue totals reload.' : 'Checking your venue activity…'}</p>}
        <div className="mt-4 divide-y divide-border/70">
          {steps.map(step => <div key={step.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="text-sm font-semibold">{step.title}</p><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{step.description}</p></div>
            <button type="button" onClick={() => handleStep(step)} disabled={(step.action === 'members' && !onMembers) || (step.action === 'verify' && !onVerification)} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{step.label}<ArrowUpRight className="h-4 w-4" /></button>
          </div>)}
        </div>
        {counts && steps.length === 0 && <p className="text-sm leading-6 text-muted-foreground">No outstanding items in these checks. Your management tools are below.</p>}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/20 bg-primary/5 p-5">
        <div className="min-w-0 max-w-xl"><p className="text-base font-semibold">{privateSample ? 'Your sample features' : accessLoading ? 'Checking feature access…' : accessError ? 'Feature access unavailable' : hasFacility ? 'Your venue features' : 'Free community, ready to grow'}</p><p className="mt-1 text-sm leading-6 text-muted-foreground">{privateSample ? 'Sample tools are included. There are no subscriptions or real charges.' : accessError ? 'We couldn’t confirm paid-feature access. Your community controls remain available.' : 'Posts, messaging, members, and community events stay free. Explore optional tools and try the interactive demo before upgrading.'}</p></div>
        <div className="flex flex-wrap gap-2">{accessError && <QuickLink label="Retry access" onClick={() => onRetryAccess?.()} />}<QuickLink label={privateSample ? 'Included features' : 'Plan & upgrades'} onClick={() => onOpenTab('modules')} /></div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-3">
          <h3 className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Manage the venue</h3>
          <span className="h-px flex-1 bg-border/70" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <ActionCard
            icon={Palette}
            title="Profile & brand"
            description="Identity, imagery, welcome copy, contact details, and venue colors."
            onClick={() => onOpenTab('profile')}
          />
          {hasFacility && <ActionCard
            icon={LayoutGrid}
            title="Courts & hours"
            description="Booking inventory, court availability, surfaces, and operating schedule."
            onClick={() => onOpenTab('facility')}
          />}
          <ActionCard
            icon={ShieldCheck}
            title="Staff access"
            description="Assign managers, organizers, and floor staff with clear authority."
            onClick={() => onOpenTab('staff')}
          />
          {canManageCommunity && (
            <ActionCard
              icon={MessageSquareText}
              title="Community controls"
              description="Member posting, Find Players, and venue chat permissions."
              onClick={() => onOpenTab('permissions')}
            />
          )}
          {chatEnabled ? (
            <ActionCard
              icon={MessageCircle}
              title="Venue chat"
              description="Open the live community conversation exactly as members see it."
              onClick={() => onOpenVenueTab('chat')}
            />
          ) : canManageCommunity ? (
            <ActionCard
              icon={MessageCircle}
              title="Enable venue chat"
              description="Chat is hidden from members. Review permissions to turn it back on."
              onClick={() => onOpenTab('permissions')}
            />
          ) : null}
          {canManageCommunity && (
            <ActionCard
              icon={UsersRound}
              title="Community roles"
              description="Review community roles and ownership for the venue space."
              onClick={() => onOpenTab('roles')}
            />
          )}
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-border/70 bg-card">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Member-facing venue</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Review the venue as your members see it.{counts ? ` ${counts.posts} feed ${counts.posts === 1 ? 'post is' : 'posts are'} currently published.` : ''}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <QuickLink label="Home" onClick={() => onOpenVenueTab('home')} />
            {accessKnown && bookingEnabled && <QuickLink label="Book" onClick={() => onOpenVenueTab('book')} />}
            <QuickLink label="Play" onClick={() => onOpenVenueTab('play')} />
            <QuickLink label="Feed" onClick={() => onOpenVenueTab('feed')} />
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number | null;
  icon: typeof LayoutGrid;
  accent?: string | null;
}) {
  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-[0_10px_30px_-28px_hsl(var(--foreground)/0.35)]">
      <div className="flex min-h-8 items-start justify-between gap-2 lg:min-h-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" style={accent ? { color: accent } : undefined} />
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-[-0.05em] tabular-nums" aria-label={value === null ? `${label} unavailable` : undefined}>{value ?? '—'}</p>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: typeof LayoutGrid;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[132px] flex-col rounded-2xl border border-border/70 bg-card p-4 text-left shadow-[0_10px_30px_-28px_hsl(var(--foreground)/0.3)] transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-[0_18px_42px_-30px_hsl(var(--foreground)/0.4)] active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className="flex w-full items-start justify-between gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 text-foreground/75 transition-colors group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
      <p className="mt-4 text-sm font-semibold">{title}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-1 rounded-lg border border-border/70 px-3 text-xs font-semibold text-foreground/75 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        'hover:border-foreground/20 hover:bg-muted/50 hover:text-foreground',
      )}
    >
      {label}<ArrowUpRight className="h-3 w-3" />
    </button>
  );
}
