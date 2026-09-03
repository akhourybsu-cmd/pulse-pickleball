import { useState } from "react";
import {
  Archive,
  Bell,
  CalendarDays,
  ChevronRight,
  Compass,
  Edit3,
  Home,
  KeyRound,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Moon,
  Plus,
  QrCode,
  Search,
  Settings,
  Share2,
  Shield,
  Swords,
  Trophy,
  User,
  Users,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { PlayerSegmentedControl } from "@/components/layout/PlayerSegmentedControl";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { GlassPanel, SocialHero, SocialStatTile } from "@/components/social/_shared";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PreviewTab = "matches" | "leagues" | "social" | "community" | "profile";

const navItems = [
  { value: "home", label: "Home", icon: Home },
  { value: "matches", label: "Matches", icon: Trophy },
  { value: "leagues", label: "Leagues", icon: Swords },
  { value: "social", label: "Social", icon: MessageCircle },
  { value: "community", label: "Community", icon: Users },
  { value: "profile", label: "Profile", icon: User },
] as const;

function MatchRow() {
  return (
    <button type="button" className="group w-full rounded-[20px] border border-border/60 bg-card/80 p-4 text-left shadow-[0_10px_28px_-24px_hsl(var(--foreground)/0.45)] transition-transform active:scale-[0.99]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Yesterday · ELEVENO</p>
          <p className="mt-1.5 truncate text-sm font-semibold">Alex & Maya vs. Jordan & Chris</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />Court 4</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-display text-xl font-bold tabular-nums">11–8</p>
          <span className="mt-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">Verified</span>
        </div>
      </div>
    </button>
  );
}

function MatchesPreview() {
  const [view, setView] = useState<"all" | "pending" | "verified">("all");
  return (
    <>
      <SocialHero eyebrow="Performance" title="Matches" action={<Button size="sm" className="h-10 rounded-xl px-3.5"><Plus className="mr-1.5 h-4 w-4" />Record</Button>}>
        <p className="mt-2 text-sm text-muted-foreground">Track results, confirm scores, and follow your PULSE record.</p>
      </SocialHero>
      <main className="mx-auto grid max-w-[1400px] gap-6 px-4 pb-10 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:px-8 lg:pt-6 xl:gap-8">
        <aside className="space-y-4 lg:order-2">
          <div className="grid grid-cols-3 divide-x divide-border/60 rounded-2xl border border-border/60 bg-card/80 py-3 text-center shadow-[0_8px_24px_-22px_hsl(var(--foreground)/0.45)]">
            {[["47", "Matches"], ["29", "Wins"], ["62%", "Win rate"]].map(([value, label]) => <div key={label}><p className="text-lg font-bold tabular-nums">{value}</p><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{label}</p></div>)}
          </div>
          <PlayerSegmentedControl value={view} onValueChange={setView} options={[{ value: "all", label: "All", count: 47 }, { value: "pending", label: "Pending", count: 2, accentCount: true }, { value: "verified", label: "Verified", count: 45 }]} ariaLabel="Match filters" layoutId="preview-match-filter" />
          <div className="hidden rounded-2xl border border-border/60 bg-card/65 p-4 lg:block"><p className="text-sm font-semibold">Your match workspace</p><p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">Confirm pending scores first, then review verified results and rating movement.</p><Button variant="outline" className="mt-4 h-10 w-full rounded-xl">Find your next game</Button></div>
        </aside>
        <section className="min-w-0 lg:order-1"><SectionHeader label="Recent matches" /><div className="space-y-3"><MatchRow /><MatchRow /><MatchRow /></div></section>
      </main>
    </>
  );
}

function LeaguesPreview() {
  return (
    <>
      <SocialHero eyebrow="Competition" title="Leagues">
        <p className="mt-2 text-sm text-muted-foreground">Compete, climb the table, and keep every season in one place.</p>
        <div className="mt-3 grid max-w-sm grid-cols-2 gap-2">
          <Button variant="outline" className="h-11 rounded-xl bg-card/80"><KeyRound className="mr-1.5 h-4 w-4" />Join with code</Button>
          <Button className="h-11 rounded-xl"><Plus className="mr-1.5 h-4 w-4" />Create league</Button>
        </div>
      </SocialHero>
      <main className="mx-auto max-w-[1400px] space-y-7 px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <section>
          <SectionHeader label="Your leagues" />
          <div className="grid gap-3 lg:grid-cols-2"><GlassPanel>
            <button type="button" className="group flex min-h-[76px] w-full items-center gap-3 p-3.5 text-left active:bg-accent/40">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary"><Trophy className="h-5 w-5" /></div>
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">ELEVENO Fall Ladder</p><p className="mt-0.5 text-xs text-muted-foreground">Division A · 12 players</p></div>
              <div className="text-right"><p className="font-bold tabular-nums">#4</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Standing</p></div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            </button>
          </GlassPanel><GlassPanel><button type="button" className="group flex min-h-[76px] w-full items-center gap-3 p-3.5 text-left"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary"><Trophy className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="truncate font-semibold">Boston Social League</p><p className="mt-0.5 text-xs text-muted-foreground">Mixed Doubles · 16 players</p></div><div className="text-right"><p className="font-bold tabular-nums">#2</p><p className="text-[10px] uppercase tracking-wider text-muted-foreground">Standing</p></div><ChevronRight className="h-4 w-4 text-muted-foreground/60" /></button></GlassPanel></div>
        </section>
        <button type="button" className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/60 px-4 text-left text-sm font-semibold text-muted-foreground"><Archive className="h-4 w-4" />Archived seasons<ChevronRight className="ml-auto h-4 w-4" /></button>
      </main>
    </>
  );
}

const conversations = [
  { initials: "11", name: "ELEVENO", message: "Maya: Court 2 is open after 6:30", time: "2m", unread: 4 },
  { initials: "MR", name: "Maya Rodriguez", message: "Perfect — see you there!", time: "18m", unread: 0 },
  { initials: "SC", name: "Sunday Crew", message: "Chris shared a photo", time: "1h", unread: 1 },
];

function SocialPreview() {
  const [view, setView] = useState<"chats" | "friends">("chats");
  return (
    <>
      <SocialHero eyebrow="Connect" title="Social">
        <PlayerSegmentedControl value={view} onValueChange={setView} options={[{ value: "chats", label: "Chats", icon: MessageCircle }, { value: "friends", label: "Friends", icon: Users }]} ariaLabel="Social views" layoutId="preview-social-view" className="mt-3 max-w-sm" />
      </SocialHero>
      <main className="mx-auto grid max-w-[1400px] gap-8 px-4 pb-10 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start lg:px-8 lg:pt-6 xl:grid-cols-[minmax(0,820px)_minmax(280px,1fr)]">
        <div className="min-w-0 lg:rounded-[24px] lg:border lg:border-border/60 lg:bg-card/55 lg:p-5">
        <div className="flex gap-2">
          <label className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-border/60 bg-card/80 px-3 text-sm text-muted-foreground"><Search className="h-4 w-4" />Search conversations</label>
          <Button size="icon" className="h-11 w-11 rounded-xl" aria-label="New message"><Edit3 className="h-4 w-4" /></Button>
        </div>
        <div className="my-3 flex gap-2"><Button variant="secondary" size="sm" className="h-9 rounded-full px-4">All</Button><Button variant="ghost" size="sm" className="h-9 rounded-full px-4">Unread</Button><Button variant="ghost" size="sm" className="h-9 rounded-full px-4">Groups</Button></div>
        <GlassPanel>
          {conversations.map((item) => <button key={item.name} type="button" className="flex min-h-[76px] w-full items-center gap-3 px-3 py-2.5 text-left active:bg-accent/40"><Avatar className="h-12 w-12 rounded-2xl"><AvatarFallback className="rounded-2xl bg-primary/12 font-bold text-primary">{item.initials}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><p className="truncate text-sm font-semibold">{item.name}</p><span className="shrink-0 text-[10px] text-muted-foreground">{item.time}</span></div><p className={cn("mt-0.5 truncate text-xs", item.unread ? "font-semibold text-foreground" : "text-muted-foreground")}>{item.message}</p></div>{item.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{item.unread}</span>}<MoreHorizontal className="h-4 w-4 text-muted-foreground/60" /></button>)}
        </GlassPanel>
        </div>
        <aside className="hidden rounded-[24px] border border-border/60 bg-card/75 p-5 lg:block"><div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary/80">At a glance</p><h2 className="mt-1 text-lg font-bold">Your inbox</h2></div><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></div></div><div className="mt-5 grid grid-cols-3 gap-2">{[["3","Chats"],["5","Unread"],["0","Muted"]].map(([value,label])=><div key={label} className="rounded-2xl border border-border/50 bg-background/65 p-3"><p className="text-xl font-bold">{value}</p><p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p></div>)}</div><Button className="mt-4 h-11 w-full rounded-xl">Start a conversation</Button></aside>
      </main>
    </>
  );
}

function CommunityPreview() {
  const [view, setView] = useState<"mine" | "explore">("mine");
  return (
    <>
      <SocialHero eyebrow="Groups" title="Community">
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PlayerSegmentedControl value={view} onValueChange={setView} options={[{ value: "mine", label: "Mine", icon: Users, count: 3 }, { value: "explore", label: "Explore", icon: Compass, count: 8, accentCount: true }]} ariaLabel="Community views" layoutId="preview-community-view" className="min-w-[190px] flex-1 lg:max-w-sm lg:flex-none" />
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto sm:gap-1.5"><Button variant="outline" size="icon" className="h-11 w-11 rounded-xl bg-card/80" aria-label="Join with code"><QrCode className="h-[18px] w-[18px]" /></Button><Button size="sm" className="h-11 flex-1 rounded-xl px-4 sm:flex-none"><Plus className="mr-1.5 h-4 w-4" />Create</Button></div>
        </div>
      </SocialHero>
      <main className="mx-auto grid max-w-[1400px] gap-3 px-4 pb-10 pt-4 sm:grid-cols-2 sm:px-6 lg:px-8 lg:pt-6 xl:grid-cols-3">
        {[{ name: "ELEVENO", meta: "Venue · 86 members", initials: "11", unread: 6 }, { name: "Sunday Crew", meta: "Private group · 12 members", initials: "SC", unread: 0 }, { name: "3.5+ Open Play", meta: "Public group · 34 members", initials: "3+", unread: 2 }].map((group) => <button key={group.name} type="button" className="group flex min-h-[72px] w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 text-left shadow-[0_2px_14px_-10px_hsl(var(--foreground)/0.35)] active:scale-[0.99]"><Avatar className="h-12 w-12 rounded-xl"><AvatarFallback className="rounded-xl bg-primary/12 font-bold text-primary">{group.initials}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{group.name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{group.meta}</p></div>{group.unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{group.unread}</span>}<ChevronRight className="h-4 w-4 text-muted-foreground/60" /></button>)}
      </main>
    </>
  );
}

function ProfilePreview() {
  const links = [[CalendarDays, "My events", "Upcoming and past registrations"], [Users, "Community", "Groups and friends"], [Settings, "Edit profile", "Name, avatar, location"], [Bell, "Notifications", "Manage what reaches you"], [Shield, "Security", "Two-factor and linked accounts"]] as const;
  return (
    <>
      <SocialHero eyebrow="Player" title="Alex Morgan" action={<Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-card/80" aria-label="Edit profile"><Edit3 className="h-[18px] w-[18px]" /></Button>}>
        <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground"><MapPin className="h-3.5 w-3.5" />Boston, MA</p>
        <div className="mt-3 flex max-w-2xl items-stretch gap-2.5"><Avatar className="h-[58px] w-[58px] shrink-0 rounded-2xl border-2 border-primary/30"><AvatarFallback className="rounded-2xl bg-primary/15 font-bold text-primary">AM</AvatarFallback></Avatar><div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5"><SocialStatTile icon={Trophy} label="Rating" value="3.82" accent /><SocialStatTile icon={Swords} label="Matches" value="47" /><SocialStatTile icon={Trophy} label="Record" value="29–18" /></div></div>
      </SocialHero>
      <main className="mx-auto grid max-w-[1400px] gap-8 px-4 pb-12 pt-4 sm:px-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(460px,1.18fr)] lg:items-start lg:px-8 lg:pt-6 xl:gap-10">
        <div className="space-y-6"><button type="button" className="flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border/60 bg-card/80 px-4 text-left shadow-[0_8px_28px_-22px_hsl(var(--foreground)/0.4)] active:scale-[0.99]"><Share2 className="h-5 w-5 text-primary" /><div><p className="text-sm font-semibold">Share your PULSE</p><p className="text-xs text-muted-foreground">Send your player profile</p></div><ChevronRight className="ml-auto h-4 w-4 text-muted-foreground/60" /></button><section><SectionHeader label="Activity" /><GlassPanel>{links.slice(0,2).map(([Icon,label,description])=><button key={label} type="button" className="flex min-h-[68px] w-full items-center gap-3.5 px-3.5 py-3 text-left"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><div><p className="font-semibold">{label}</p><p className="text-xs text-muted-foreground">{description}</p></div></button>)}</GlassPanel></section></div>
        <section><SectionHeader label="Your account" /><GlassPanel>{links.map(([Icon, label, description]) => <button key={label} type="button" className="flex min-h-[68px] w-full items-center gap-3.5 px-3.5 py-3 text-left active:bg-accent/40"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-semibold leading-tight">{label}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p></div><ChevronRight className="h-4 w-4 text-muted-foreground/60" /></button>)}</GlassPanel></section>
      </main>
    </>
  );
}

export default function PlayerTabsPreview() {
  const requested = new URLSearchParams(window.location.search).get("tab") as PreviewTab | null;
  const [active, setActive] = useState<PreviewTab>(requested && ["matches", "leagues", "social", "community", "profile"].includes(requested) ? requested : "matches");

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-secondary-foreground/10 bg-secondary shadow-sm">
        <div className="mx-auto flex h-[68px] max-w-[1400px] items-center justify-between gap-2 px-4 sm:h-[72px] sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-5 lg:px-8">
          <Logo className="h-[42px] w-auto shrink-0 text-secondary-foreground sm:h-[54px] lg:col-start-1 lg:row-start-1 lg:h-[60px] lg:justify-self-start" />
          <nav className="hidden items-center justify-center lg:col-start-2 lg:row-start-1 lg:flex lg:justify-self-center">
            <div className="flex items-center gap-1 rounded-2xl border border-secondary-foreground/10 bg-secondary-foreground/[0.045] p-1">
              {navItems.map(({value,label,icon:Icon})=>{const selected=value===active;return <button key={value} type="button" onClick={()=>value!=="home"&&setActive(value)} className={cn("flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium xl:px-4",selected?"bg-background/95 text-foreground shadow-sm":"text-secondary-foreground/70")}><Icon className={cn("hidden h-[17px] w-[17px] xl:block",selected&&"text-primary")} />{label}</button>})}
            </div>
          </nav>
          <div className="flex shrink-0 items-center justify-self-end text-secondary-foreground sm:gap-1 lg:col-start-3 lg:row-start-1 xl:gap-2">
            {[Moon, MessageCircle].map((Icon, index) => <Button key={`utility-${index}`} variant="ghost" size="icon" className="h-10 w-10 rounded-full text-current hover:bg-secondary-foreground/10"><Icon className="h-[18px] w-[18px]" /></Button>)}
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-current hover:bg-secondary-foreground/10"><Bell className="h-[18px] w-[18px]" /></Button>
            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-current hover:bg-secondary-foreground/10"><Avatar className="h-9 w-9 border border-secondary-foreground/20"><AvatarFallback className="bg-secondary-foreground/10 text-xs text-secondary-foreground">AM</AvatarFallback></Avatar></Button>
          </div>
        </div>
      </header>

      {active === "matches" && <MatchesPreview />}
      {active === "leagues" && <LeaguesPreview />}
      {active === "social" && <SocialPreview />}
      {active === "community" && <CommunityPreview />}
      {active === "profile" && <ProfilePreview />}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border/40 bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_-22px_hsl(var(--foreground)/0.65)] backdrop-blur-xl lg:hidden">
        <div className="flex items-center justify-around px-1 py-2">
          {navItems.map(({ value, label, icon: Icon }) => {
            const selected = value === active;
            return <button key={value} type="button" onClick={() => value !== "home" && setActive(value)} className={cn("flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-0.5 font-medium transition-colors active:scale-95", selected ? "text-primary" : "text-muted-foreground/75")}><span className={cn("flex h-8 w-10 items-center justify-center rounded-xl", selected && "bg-primary/10")}><Icon className="h-[21px] w-[21px]" /></span><span className="max-w-full truncate text-[clamp(8px,2.55vw,10px)] tracking-[-0.035em]">{label}</span></button>;
          })}
        </div>
      </nav>
    </div>
  );
}
