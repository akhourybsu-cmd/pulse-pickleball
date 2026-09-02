import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { isPlatformAdmin } from '@/lib/permissions';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  User as UserIcon,
  Settings,
  Bell,
  Users,
  MessageSquare,
  Calendar,
  ClipboardList,
  Download,
  LogOut,
  ChevronRight,
  Pencil,
  Share2,
  UserPlus,
  HelpCircle,
  RefreshCw,
  Shield,
  CalendarDays,
  ListOrdered,
  Gauge,
  Trash2,
  Trophy,
  MapPin,
} from 'lucide-react';
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { SkillAssessmentCTA } from '@/components/skill/SkillAssessmentCTA';
import { SocialHero, SocialStatTile, GlassPanel } from '@/components/social/_shared';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface ProfileSummary {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  current_rating: number | null;
  total_matches: number | null;
  wins: number | null;
  losses: number | null;
  state: string | null;
  town: string | null;
}

interface HubLink {
  to: string;
  icon: typeof UserIcon;
  label: string;
  description: string;
}

const ACTIVITY_LINKS: HubLink[] = [
  {
    to: '/player/my-events',
    icon: Calendar,
    label: 'My Events',
    description: 'Upcoming and past registrations',
  },
  {
    to: '/player/guests',
    icon: UserPlus,
    label: 'My Guests',
    description: 'Guest players you add to matches and events',
  },
];

// Leagues is reached from the persistent bottom-nav "Leagues" tab, so it is
// intentionally NOT duplicated as an Activity row here (one persistent entry
// point, no conflicting surfaces).

const COMMUNITY_LINKS: HubLink[] = [
  {
    to: '/player/community',
    icon: Users,
    label: 'Community',
    description: 'Groups and friends',
  },
  {
    to: '/player/messages',
    icon: MessageSquare,
    label: 'Messages',
    description: 'Direct conversations',
  },
];

const SKILL_ASSESSMENT_LINK: HubLink = {
  to: '/player/self-assessment',
  icon: Gauge,
  label: 'Skill self-assessment',
  description: 'Estimate your current level',
};

const ACCOUNT_LINKS: HubLink[] = [
  {
    to: '/profile/edit',
    icon: Pencil,
    label: 'Edit profile',
    description: 'Name, avatar, location',
  },
  {
    to: '/settings/notifications',
    icon: Bell,
    label: 'Notifications',
    description: 'Manage what reaches you',
  },
  {
    to: '/settings/security',
    icon: Shield,
    label: 'Security',
    description: 'Two-factor, biometrics, linked accounts',
  },
  {
    to: '/profile/data-export',
    icon: Download,
    label: 'Export data',
    description: 'Download your match history',
  },
  {
    to: '/faq',
    icon: HelpCircle,
    label: 'Help & FAQ',
    description: 'Guides and answers',
  },
  {
    to: '/delete-account',
    icon: Trash2,
    label: 'Delete account',
    description: 'Permanently remove your account',
  },
];

/**
 * Phase 5 — Profile rebuilt as the player's command center.
 *
 * Layout:
 *   • PlayerPageHeader (shared across all four player tabs)
 *   • Identity hero card — same PlayerIdentityCard used on Home, so the
 *     player sees the same self-portrait in both places. Stats + rating
 *     + win rate ring + location.
 *   • "Share your PULSE" CTA — Web Share API w/ clipboard fallback.
 *   • Grouped hub links via SectionHeader (Activity / Community / Account).
 *   • Admin row — refresh stats + admin dashboard shortcut, only when
 *     the user is a platform admin. Migrated from HomeFooterUtilities.
 *   • Demoted sign-out at the bottom.
 */
export default function PlayerProfile() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const accountLinks = isSkillAssessmentEnabled()
    ? [SKILL_ASSESSMENT_LINK, ...ACCOUNT_LINKS]
    : ACCOUNT_LINKS;

  const activityLinks = ACTIVITY_LINKS;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setLoading(false);
        return;
      }
      setUserId(user.id);

      const [profileResult, adminResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, full_name, avatar_url, current_rating, total_matches, wins, losses, state, town')
          .eq('id', user.id)
          .maybeSingle(),
        isPlatformAdmin(user.id),
      ]);

      if (!cancelled) {
        setProfile(profileResult.data as ProfileSummary | null);
        setIsAdmin(adminResult);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const handleRefreshStats = async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url, current_rating, total_matches, wins, losses, state, town')
        .eq('id', userId)
        .single();
      if (error) {
        toast.error('Failed to refresh stats');
        return;
      }
      setProfile(data as ProfileSummary);
      toast.success('Stats refreshed');
    } catch {
      toast.error('Failed to refresh stats');
    } finally {
      setRefreshing(false);
    }
  };

  const handleShare = async () => {
    if (!profile?.id) {
      toast.error('Profile not ready yet');
      return;
    }
    const url = `${window.location.origin}/profile/${profile.id}`;
    const name = profile.display_name || profile.full_name || 'My PULSE profile';
    const shareText = `Check out ${name} on PULSE Pickleball`;

    try {
      if (typeof navigator !== 'undefined' && (navigator as Navigator & { share?: (data: ShareData) => Promise<void> }).share) {
        await (navigator as Navigator & { share: (data: ShareData) => Promise<void> }).share({
          title: shareText,
          url,
        });
        return;
      }
    } catch {
      // user cancelled or share failed — fall through to clipboard
    }

    try {
      await navigator.clipboard.writeText(url);
      toast.success('Profile link copied to clipboard');
    } catch {
      toast.error('Could not copy link');
    }
  };

  const locationStr = [profile?.town, profile?.state].filter(Boolean).join(', ') || null;
  const profileName = profile?.display_name || profile?.full_name || (loading ? 'Profile' : 'Your profile');
  const profileInitials = profileName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const renderLinkGroup = (links: HubLink[], delayMs: number) => (
    <GlassPanel
      className="opacity-0 animate-fade-up"
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: 'forwards' }}
    >
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <button
            key={link.to}
            onClick={() => navigate(link.to)}
            type="button"
            className={cn(
              'group flex min-h-[68px] w-full items-center gap-3.5 px-3.5 py-3 text-left transition-[transform,background-color] hover:bg-accent/40 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary motion-reduce:transform-none',
              link.to === '/delete-account' && 'hover:bg-destructive/5',
            )}
          >
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15",
              link.to === '/delete-account' && 'bg-destructive/10 text-destructive group-hover:bg-destructive/15',
            )}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className={cn('font-semibold leading-tight', link.to === '/delete-account' && 'text-destructive')}>{link.label}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{link.description}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
          </button>
        );
      })}
    </GlassPanel>
  );

  return (
    <div className="min-h-screen bg-background">
      <SocialHero
        eyebrow="Player"
        title={profileName}
        action={
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate('/player/profile/edit')}
            className="h-10 w-10 rounded-xl border-border/60 bg-card/80 active:scale-95"
            aria-label="Edit profile"
          >
            <Pencil className="h-[18px] w-[18px]" />
          </Button>
        }
      >
        {locationStr && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5" />
            {locationStr}
          </p>
        )}
        <div className="mt-3 flex max-w-2xl items-stretch gap-2.5">
          <Avatar className="h-[58px] w-[58px] shrink-0 rounded-2xl border-2 border-primary/30 shadow-sm">
            <AvatarImage src={profile?.avatar_url || undefined} alt={profileName} />
            <AvatarFallback className="rounded-2xl bg-primary/15 font-bold text-primary">{profileInitials}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-1.5 sm:gap-2">
            <SocialStatTile icon={Gauge} label="Rating" value={profile?.current_rating ? profile.current_rating.toFixed(2) : '—'} accent />
            <SocialStatTile icon={Trophy} label="Matches" value={String(profile?.total_matches || 0)} />
            <SocialStatTile icon={ClipboardList} label="Record" value={`${profile?.wins || 0}–${profile?.losses || 0}`} />
          </div>
        </div>
      </SocialHero>

      <div className="container mx-auto max-w-[1400px] px-4 pb-12 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.82fr)_minmax(460px,1.18fr)] lg:items-start xl:gap-10">
          <div className="space-y-7">

        {/* Skill assessment — hero CTA at the top of the profile. */}
        <SkillAssessmentCTA userId={userId} />

        {/* Share CTA */}
        <div
          className="opacity-0 animate-fade-up"
          style={{ animationDelay: '120ms', animationFillMode: 'forwards' }}
        >
          <Button
            onClick={handleShare}
            variant="outline"
            className="h-12 w-full gap-2 rounded-2xl border-border/60 bg-card/80 text-base font-semibold shadow-[0_8px_22px_-20px_hsl(var(--foreground)/0.5)] active:scale-[0.99]"
            disabled={loading || !profile?.id}
          >
            <Share2 className="h-4 w-4" />
            Share your PULSE
          </Button>
        </div>


        {/* Activity group. Leagues lives in the bottom-nav Leagues tab, not here. */}
        <div>
          <SectionHeader label="Activity" />
          {renderLinkGroup(activityLinks, 180)}
        </div>

        {/* Community group */}
        <div>
          <SectionHeader label="Community" />
          {renderLinkGroup(COMMUNITY_LINKS, 240)}
        </div>

          </div>
          <div className="space-y-7">

        {/* Account group */}
        <div>
          <SectionHeader label="Account" />
          {renderLinkGroup(accountLinks, 300)}
        </div>

        {/* Admin row — only when isPlatformAdmin. Migrated from
            HomeFooterUtilities. Demoted styling so it doesn't compete
            with the player-first content above. */}
        {isAdmin && (
          <div
            className="opacity-0 animate-fade-up"
            style={{ animationDelay: '360ms', animationFillMode: 'forwards' }}
          >
            <SectionHeader label="Admin" />
            <div className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2">
              <button
                onClick={() => navigate('/admin')}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-background/60 active:scale-[0.99] transition-all text-left"
              >
                <Shield className="h-4 w-4 text-primary shrink-0" />
                <span className="text-sm font-medium flex-1">Admin dashboard</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
              </button>

              <button
                onClick={() => navigate('/events')}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-background/60 active:scale-[0.99] transition-all text-left"
              >
                <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium flex-1">Events manager</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
              </button>

              <button
                onClick={() => navigate('/session/queue')}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-background/60 active:scale-[0.99] transition-all text-left"
              >
                <ListOrdered className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium flex-1">Session queue</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
              </button>

              <button
                onClick={handleRefreshStats}
                disabled={refreshing}
                className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-background/60 active:scale-[0.99] transition-all text-left disabled:opacity-50"
              >
                <RefreshCw
                  className={cn('h-4 w-4 text-muted-foreground shrink-0', refreshing && 'animate-spin')}
                />
                <span className="text-sm font-medium flex-1">
                  {refreshing ? 'Refreshing…' : 'Refresh stats'}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Demoted sign-out */}
        <div
          className="opacity-0 animate-fade-up"
          style={{ animationDelay: '420ms', animationFillMode: 'forwards' }}
        >
          <Button
            variant="ghost"
            className="w-full text-muted-foreground hover:text-destructive hover:bg-destructive/5"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
          </div>
        </div>
      </div>
    </div>
  );
}
