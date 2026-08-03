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
  Trophy,
  Gauge,
  Trash2,
} from 'lucide-react';
import { useLeagueEntitlement } from '@/hooks/useLeagueEntitlement';
import { isSkillAssessmentEnabled } from '@/lib/skill/featureFlag';
import { cn } from '@/lib/utils';
import { SectionHeader } from '@/components/layout/SectionHeader';
import { SkillAssessmentCTA } from '@/components/skill/SkillAssessmentCTA';

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

/**
 * Leagues row is composed at render time so the entitlement hook
 * can gate it. If the player isn't entitled we don't want a dead
 * link to /player/leagues in the Activity group.
 */
const LEAGUES_LINK: HubLink = {
  to: '/player/leagues',
  icon: Trophy,
  label: 'Leagues',
  description: 'Standings, schedule, and teammates',
};

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
  const { entitled: leagueEntitled } = useLeagueEntitlement();
  const accountLinks = isSkillAssessmentEnabled()
    ? [SKILL_ASSESSMENT_LINK, ...ACCOUNT_LINKS]
    : ACCOUNT_LINKS;

  const activityLinks = leagueEntitled
    ? [...ACTIVITY_LINKS, LEAGUES_LINK]
    : ACTIVITY_LINKS;

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

  const renderLinkGroup = (links: HubLink[], delayMs: number) => (
    <div
      className="space-y-2 opacity-0 animate-fade-up"
      style={{ animationDelay: `${delayMs}ms`, animationFillMode: 'forwards' }}
    >
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <button
            key={link.to}
            onClick={() => navigate(link.to)}
            className={cn(
              'w-full flex items-center gap-4 rounded-xl border border-border/60 bg-card px-4 py-3.5',
              'hover:bg-accent/40 hover:border-border active:scale-[0.99] transition-all text-left',
              'group',
            )}
          >
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium leading-tight">{link.label}</div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">{link.description}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all" />
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-5 max-w-3xl space-y-7 pb-12">
        {/* Centered identity — the name gets a gold gradient so it reads as the
            top of the profile and pops. The full stats card lives on Home. */}
        <div className="text-center pt-2">
          <h1 className="inline-block text-[26px] font-extrabold tracking-tight leading-tight bg-gradient-to-r from-primary to-amber-500 bg-clip-text text-transparent">
            {profile?.display_name || profile?.full_name || (loading ? '' : 'Your profile')}
          </h1>
          {locationStr && (
            <p className="text-sm text-muted-foreground mt-1">{locationStr}</p>
          )}
        </div>

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
            className="w-full h-12 gap-2 text-base font-semibold"
            disabled={loading || !profile?.id}
          >
            <Share2 className="h-4 w-4" />
            Share your PULSE
          </Button>
        </div>


        {/* Activity group — Leagues row appears when entitled. */}
        <div>
          <SectionHeader label="Activity" />
          {renderLinkGroup(activityLinks, 180)}
        </div>

        {/* Community group */}
        <div>
          <SectionHeader label="Community" />
          {renderLinkGroup(COMMUNITY_LINKS, 240)}
        </div>

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
          className="pt-4 opacity-0 animate-fade-up"
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
  );
}
