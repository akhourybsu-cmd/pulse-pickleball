import { Link } from "react-router-dom";
import {
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Home,
  MapPin,
  MessageCircle,
  Moon,
  Repeat,
  Swords,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { ProfileHero } from "@/components/dashboard/ProfileHero";
import { QuickActionsBar } from "@/components/dashboard/QuickActionsBar";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const actionClass =
  "inline-flex min-h-8 items-center rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

const people = [
  { name: "Maya", initials: "MR" },
  { name: "Chris", initials: "CT" },
  { name: "Jordan", initials: "JL" },
];

function AttentionPreview() {
  return (
    <div className="px-3 py-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
        <CheckCircle2 className="h-6 w-6 text-primary" />
      </div>
      <p className="text-sm font-semibold text-foreground">All caught up</p>
      <p className="mt-1 text-xs text-muted-foreground">No pending actions or upcoming alerts</p>
    </div>
  );
}

function RoundRobinPreview() {
  return (
    <button
      type="button"
      className="group flex min-h-[68px] w-full items-center gap-3 rounded-xl border border-primary/35 bg-primary/[0.03] px-3 py-3 text-left transition-all hover:border-primary/50 hover:bg-primary/[0.06] active:scale-[0.985] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transform-none"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground ring-2 ring-primary/25">
        <Trophy className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-1.5">
          <span className="rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary-foreground">Live</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Playing</span>
        </div>
        <p className="truncate text-sm font-semibold text-foreground">Tuesday Night Ladder</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Round 3 of 6</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function SocialPreview({ communities = false }: { communities?: boolean }) {
  const rows = communities
    ? [
        { name: "ELEVENO", initials: "11" },
        { name: "Sunday Crew", initials: "SC" },
        { name: "3.5+ Play", initials: "3+" },
      ]
    : people;

  return (
    <div className="-mx-4 flex gap-3 overflow-hidden px-4 pb-2 lg:mx-0 lg:px-0">
      {rows.map((item, index) => (
        <Link
          key={item.name}
          to="#"
          className="group relative flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl border border-border/60 bg-card/70 p-3 transition-[transform,border-color] hover:-translate-y-0.5 hover:border-primary/25 active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Avatar className="h-14 w-14 rounded-2xl ring-1 ring-border/60">
            <AvatarFallback className={cn("rounded-2xl font-semibold text-primary", index === 0 ? "bg-primary/20" : "bg-primary/10")}>
              {item.initials}
            </AvatarFallback>
          </Avatar>
          {index === 0 && communities && <span className="absolute right-4 top-2.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />}
          <p className="line-clamp-2 text-center text-xs font-semibold leading-tight tracking-tight text-foreground">{item.name}</p>
        </Link>
      ))}
    </div>
  );
}

function UpNextPreview() {
  return (
    <div className="overflow-hidden rounded-[20px] border border-border/60 bg-card shadow-[0_14px_36px_-32px_hsl(var(--foreground)/0.55)]">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <p className="flex items-center gap-2 text-sm font-medium"><CalendarDays className="h-4 w-4 text-primary" />Upcoming play</p>
        <span className="text-xs text-muted-foreground">View all</span>
      </div>
      <div className="space-y-2 p-3">
        <button type="button" className="group flex min-h-[64px] w-full items-center gap-3 rounded-xl border border-transparent bg-muted/45 p-2.5 text-left transition-colors hover:border-border/70 hover:bg-muted">
          <div className="flex h-11 w-11 flex-col items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-[10px] font-medium uppercase">Sep</span><span className="text-base font-bold leading-none">4</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Morning Open Play</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />ELEVENO · 8:00 AM</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </button>
      </div>
    </div>
  );
}

function RecentFormPreview() {
  return (
    <div className="rounded-[20px] border border-border/60 bg-card p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Yesterday · ELEVENO</p>
          <p className="mt-1 font-semibold tracking-tight">Maya & Alex vs. Jordan & Chris</p>
        </div>
        <div className="text-right">
          <p className="font-display text-xl font-bold tabular-nums">11–8</p>
          <p className="text-xs font-semibold text-primary">+0.04</p>
        </div>
      </div>
    </div>
  );
}

function MobileSection({ label, children }: { label: string; children: React.ReactNode }) {
  return <section><SectionHeader label={label} />{children}</section>;
}

export default function DashboardPreview() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background pb-20">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_18%_0%,hsl(var(--primary)/0.07),transparent_44%)]" />

      <header className="sticky top-0 z-40 border-b border-secondary-foreground/10 bg-secondary shadow-sm">
        <div className="mx-auto grid h-16 w-full max-w-[1400px] grid-cols-[auto_1fr_auto] items-center gap-5 px-4 lg:h-[72px] lg:px-8">
          <Logo className="h-[52px] w-auto text-secondary-foreground lg:h-[65px]" />
          <nav aria-label="Preview primary navigation" className="hidden items-center justify-center lg:flex">
            <div className="flex items-center gap-1 rounded-2xl border border-secondary-foreground/10 bg-secondary-foreground/[0.045] p-1">
              {[
                { label: "Home", icon: Home, active: true },
                { label: "Matches", icon: Trophy },
                { label: "Leagues", icon: Swords },
                { label: "Social", icon: MessageCircle },
                { label: "Community", icon: Users },
                { label: "Profile", icon: User },
              ].map(({ label, icon: Icon, active }) => (
                <button key={label} type="button" className={cn("flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium xl:px-4", active ? "bg-background/95 text-foreground shadow-sm" : "text-secondary-foreground/70")}>
                  <Icon className={cn("hidden h-[17px] w-[17px] xl:block", active && "text-primary")} />
                  {label}
                </button>
              ))}
            </div>
          </nav>
          <div className="flex items-center gap-1.5 text-secondary-foreground">
            {[Moon, MessageCircle, Bell, User].map((Icon, index) => (
              <button key={index} type="button" aria-label="Preview navigation control" className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-secondary-foreground/10 active:scale-95">
                <Icon className="h-[18px] w-[18px]" />
              </button>
            ))}
          </div>
        </div>
      </header>

      <ProfileHero
        userId="dashboard-preview"
        fullName="Alex Morgan"
        displayName="Alex Morgan"
        avatarUrl={null}
        location="Boston, MA"
        currentRating={3.82}
        totalMatches={47}
        wins={29}
        losses={18}
      />

      <main className="relative mx-auto w-full max-w-[1400px] px-4 pb-10 pt-4 lg:px-8 lg:pt-5">
        <div className="hidden lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-7 xl:grid-cols-[minmax(0,1fr)_400px] xl:gap-9">
          <div className="space-y-9 xl:space-y-10">
            <section><SectionHeader label="Quick actions" /><QuickActionsBar /></section>
            <section>
              <SectionHeader label="My round robins" action={<Link to="#" className={actionClass}>View all →</Link>} />
              <RoundRobinPreview />
            </section>
            <div className="grid grid-cols-2 gap-4">
              <section className="min-w-0 rounded-[22px] border border-border/60 bg-card/80 p-4 shadow-[0_14px_36px_-32px_hsl(var(--foreground)/0.5)]">
                <SectionHeader label="My communities" action={<Link to="#" className={actionClass}>See all →</Link>} />
                <SocialPreview communities />
              </section>
              <section className="min-w-0 rounded-[22px] border border-border/60 bg-card/80 p-4 shadow-[0_14px_36px_-32px_hsl(var(--foreground)/0.5)]">
                <SectionHeader label="My friends" action={<Link to="#" className={actionClass}>View all →</Link>} />
                <SocialPreview />
              </section>
            </div>
            <section><SectionHeader label="Recent form" action={<Link to="#" className={actionClass}>All matches →</Link>} /><RecentFormPreview /></section>
          </div>

          <aside>
            <div className="sticky top-[92px] space-y-7">
              <section><SectionHeader label="Needs attention" /><div className="overflow-hidden rounded-[22px] border border-border/60 bg-card shadow-[0_14px_36px_-32px_hsl(var(--foreground)/0.55)]"><AttentionPreview /></div></section>
              <section><SectionHeader label="Up next" action={<Link to="#" className={actionClass}>Find more →</Link>} /><UpNextPreview /></section>
            </div>
          </aside>
        </div>

        <div className="mt-5 space-y-8 lg:hidden">
          <MobileSection label="Needs attention"><div className="rounded-[20px] border border-border/60 bg-card p-4 shadow-[0_12px_30px_-28px_hsl(var(--foreground)/0.5)]"><AttentionPreview /></div></MobileSection>
          <MobileSection label="My round robins"><RoundRobinPreview /></MobileSection>
          <MobileSection label="My communities"><SocialPreview communities /></MobileSection>
          <MobileSection label="My friends"><SocialPreview /></MobileSection>
          <MobileSection label="Up next"><UpNextPreview /></MobileSection>
          <MobileSection label="Recent form"><RecentFormPreview /></MobileSection>
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/40 bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-22px_hsl(var(--foreground)/0.65)] backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-around px-1 py-2">
          {[
            { label: "Home", icon: Home, active: true },
            { label: "Matches", icon: Trophy },
            { label: "Leagues", icon: Swords },
            { label: "Social", icon: MessageCircle },
            { label: "Community", icon: Users },
            { label: "Profile", icon: User },
          ].map(({ label, icon: Icon, active }) => (
            <button key={label} type="button" className={cn("flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-0.5 font-medium transition-transform active:scale-95", active ? "text-primary" : "text-muted-foreground/75")}>
              <span className={cn("flex h-8 w-10 items-center justify-center rounded-xl", active && "bg-primary/10")}><Icon className="h-[21px] w-[21px]" /></span><span className="max-w-full truncate text-[clamp(8px,2.55vw,10px)] tracking-[-0.035em]">{label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
