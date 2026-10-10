import { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Settings, Users, MessageSquare, MessageCircle, Calendar,
  FolderOpen, Plus, Share2, MoreVertical, MoreHorizontal, Bell,
  Lock, Globe, Eye, BadgeCheck
} from 'lucide-react';
import { useAuthState } from '@/hooks/useAuthState';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { isVenueCommunitiesEnabled } from '@/lib/venues/featureFlag';
import { venueChrome } from '@/lib/venues/branding';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CommunityJoinAction } from '@/components/community/CommunityJoinAction';
import { GroupFeed } from '@/components/community/GroupFeed';
import { GroupSchedule } from '@/components/community/GroupSchedule';
import { GroupFiles } from '@/components/community/GroupFiles';
import { GroupMembers } from '@/components/community/GroupMembers';
import { GroupChat } from '@/components/community/GroupChat';
import { InviteModal } from '@/components/community/InviteModal';
import { communityUrl } from '@/lib/communityShare';
import { QuickPostComposer, type PostType } from '@/components/community/QuickPostComposer';
import { CollapsedComposerBar } from '@/components/community/CollapsedComposerBar';
import { useGroupDetail } from '@/hooks/useGroupDetail';
import { useGroupPosts } from '@/hooks/useGroupPosts';
import { useGroupPresence } from '@/hooks/useGroupPresence';
import { useGroupRealtime } from '@/hooks/useGroupRealtime';
import { EnablePushBanner } from '@/components/dashboard/EnablePushBanner';
import { GroupNotificationSettingsSheet } from '@/components/community/GroupNotificationSettingsSheet';
import { VenueWelcome } from '@/components/community/VenueWelcome';
import { CommunityBrandMark } from '@/components/community/CommunityBrandMark';
import { VenueCoverImage } from '@/components/venue/VenueCoverImage';
import { parseGroupSettings } from '@/types/groupSettings';
import { useVisualViewportPane } from '@/hooks/useVisualViewportPane';
import { CommunityIdentity } from '@/components/community/CommunityIdentity';
import { ClubhouseNavigation } from '@/components/community/ClubhouseNavigation';
import { CommunityLoadError } from '@/components/community/CommunityLoadError';
import { communityAbilities } from '@/lib/community/navigation';
import { useCommunityTabs } from '@/hooks/useCommunityTabs';
import { useReturnNavigation } from '@/hooks/useReturnNavigation';



export default function GroupDetail() {
  const viewport = useVisualViewportPane();
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const mobile = useIsMobile();
  const { user, profile: currentUserProfile } = useAuthState();
  const currentUserId = user?.id ?? null;
  const { group, membership, loading, isError, refetch } = useGroupDetail(groupId);
  const groupSettings = useMemo(() => parseGroupSettings(group?.settings), [group?.settings]);
  const abilities = communityAbilities(group?.settings, membership);

  const [searchParams] = useSearchParams();
  const returnToVenue = isVenueCommunitiesEnabled() && !!group?.venue && searchParams.get('view') === 'community';
  const communityReturn = useReturnNavigation(
    returnToVenue ? `/player/community/group/${groupId}` : '/player/community',
    returnToVenue ? 'Venue' : 'Communities',
  );
  const { activeTab, visitedTabs, handleTabChange } = useCommunityTabs(groupSettings.chat_enabled);
  const [notifSettingsOpen, setNotifSettingsOpen] = useState(false);
  
  

  // Modal states
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [quickPostOpen, setQuickPostOpen] = useState(false);
  const [quickPostType, setQuickPostType] = useState<PostType>('post');

  // This parent only needs the mutation. Feed data loads when its panel mounts.
  const { createPost } = useGroupPosts(groupId, { enabled: false });
  
  // Single presence subscription at parent level
  const memberGroupId = membership?.status === 'active' ? groupId : undefined;
  const presence = useGroupPresence(memberGroupId);
  const { onlineCount, isConnected, isOnline } = presence;
  
  // Single realtime subscription for all group data
  useGroupRealtime(memberGroupId);

  const openQuickPost = useCallback((type: PostType) => {
    if (!abilities.post || (type === 'lfg' && !abilities.lfg)) return;
    setQuickPostType(type);
    setQuickPostOpen(true);
  }, [abilities.post, abilities.lfg]);

  const handleQuickPost = useCallback(async (data: Parameters<typeof createPost>[0]) => {
    if (!abilities.post || (data.type === 'lfg' && !abilities.lfg)) return false;
    const result = await createPost(data);
    return !!result;
  }, [createPost, abilities.post, abilities.lfg]);

  const isAdmin = membership?.role === 'owner' || membership?.role === 'moderator';
  const canSendChat = abilities.sendChat;
  
  // Venue branding. The accent plumbing below (the --venue-primary custom
  // property, the tinted tab underline) has always been here; it was fed a
  // hard-coded null while the venue feature was retired. It now reads the
  // venue joined onto the group, behind the flag, and falls back to standard
  // Pulse chrome for every other community.
  const isVenueGroup = isVenueCommunitiesEnabled() && !!group?.venue;
  const chrome = useMemo(
    () => (isVenueGroup ? venueChrome(group?.venue) : null),
    [isVenueGroup, group?.venue],
  );
  const venueColor: string | null = chrome?.accent ?? null;

  // Memoize tab config — labeled tabs with More holding Files/Settings
  const tabs = useMemo(() => [
    { value: 'feed', icon: MessageSquare, label: 'Feed' },
    { value: 'schedule', icon: Calendar, label: 'Events' },
    { value: 'chat', icon: MessageCircle, label: 'Chat' },
    { value: 'members', icon: Users, label: 'Members' },
    { value: 'more', icon: MoreHorizontal, label: 'More' },
  ].filter(tab => tab.value !== 'chat' || groupSettings.chat_enabled), [groupSettings.chat_enabled]);

  // Human-readable subtitle: "{Visibility} {Type} · N members"
  const typeLabel = useMemo(() => {
    const map: Record<string, string> = {
      crew: 'Crew',
      league: 'League',
      open_play: 'Open Play',
      venue_official: 'Venue',
      tournament: 'Tournament',
      club: 'Pickleball club',
    };
    return group ? (map[group.type] || 'Group') : 'Group';
  }, [group]);
  const visibilityLabel = group?.visibility === 'private'
    ? 'Private'
    : group?.visibility === 'unlisted' ? 'Unlisted' : 'Public';
  const memberCount = group?.member_count ?? 0;
  const subtitle = `${visibilityLabel} ${typeLabel} · ${memberCount} ${memberCount === 1 ? 'member' : 'members'}`;
  const VisibilityIcon = group?.visibility === 'private'
    ? Lock
    : group?.visibility === 'unlisted' ? Eye : Globe;

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError && !group) return <div className="mx-auto max-w-xl p-6"><CommunityLoadError subject="this community" onRetry={refetch} /></div>;

  if (!group) {
    return (
      <div className="px-4 py-12 text-center">
        <h2 className="text-lg font-medium">Group not found</h2>
        <Button onClick={communityReturn.goBack} variant="outline" size="sm" className="mt-4">
          Back to {communityReturn.label}
        </Button>
      </div>
    );
  }

  // Non-member gate. RLS already blocks non-member reads of posts/chat
  // server-side, but without this gate a non-member deep-linking to a
  // public group saw the full tab UI with empty, broken-looking content
  // and no way to join. Pending members see their request status.
  if (!membership || membership.status !== 'active') {

    return (
      <div className="w-full px-3 py-6 max-w-2xl mx-auto font-sans">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-6 text-muted-foreground"
          onClick={communityReturn.goBack}
        >
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {communityReturn.label}
        </Button>
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          {!isVenueGroup ? <CommunityIdentity group={group} label={typeLabel} /> : <div className="p-6 text-center">
            <CommunityBrandMark group={group} className="mx-auto h-20 w-20 bg-secondary text-[80px]" />
            <h1 className="font-sans text-2xl font-semibold [overflow-wrap:anywhere]">{group.name}</h1>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>}
          <div className="space-y-4 p-6">
          {group.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{group.description}</p>
          )}
          <CommunityJoinAction key={group.id + ":" + currentUserId} group={group} membership={membership} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={cn('flex flex-col h-[100dvh]', isVenueGroup ? 'venue-community-frame font-sans [&_h1]:font-sans [&_h2]:font-sans' : 'community-clubhouse')}
      style={isVenueGroup ? {
        '--venue-primary': venueColor,
        '--venue-pane-height': viewport.height,
        '--venue-pane-top': viewport.top ?? 0,
      } as React.CSSProperties : viewport}
    >
      {!isVenueGroup && <>
        <div className="club-toolbar">
          <Button variant="ghost" className="gap-2 px-2 text-xs" onClick={communityReturn.goBack}><ArrowLeft className="h-4 w-4" />{communityReturn.label}</Button>
          <div className="flex items-center gap-1">
            {(group.invite_code || group.visibility === 'public') && <Button variant="ghost" size="icon" aria-label={`Share ${group.name}`} onClick={() => setInviteModalOpen(true)}><Share2 className="h-4 w-4" /></Button>}
            <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Community options"><MoreHorizontal className="h-5 w-5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setNotifSettingsOpen(true)}><Bell className="mr-2 h-4 w-4" />Notifications</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleTabChange('more')}><FolderOpen className="mr-2 h-4 w-4" />About & resources</DropdownMenuItem>
              {isAdmin && <DropdownMenuItem onClick={() => navigate(`/player/community/group/${groupId}/manage`)}><Settings className="mr-2 h-4 w-4" />Manage community</DropdownMenuItem>}
            </DropdownMenuContent></DropdownMenu>
            {abilities.post && <Button className="club-create ml-2 gap-1.5 text-xs" onClick={() => openQuickPost('post')}><Plus className="h-4 w-4" />Post</Button>}
          </div>
        </div>
        <CommunityIdentity group={group} label={typeLabel} compact={activeTab === 'chat'} />
      </>}
      {isVenueGroup && group.venue?.cover_image_url && activeTab !== 'chat' && <div className="hidden relative h-[clamp(7rem,20vw,12rem)] w-full shrink-0 overflow-hidden bg-[#171a1f] lg:block lg:h-24 xl:h-28">
        <VenueCoverImage src={group.venue.cover_image_url} fit={group.venue.cover_image_fit} crop={group.venue.cover_crop} focalPoint={group.venue.cover_focal_point} alt={`${group.name} banner`} />
      </div>}
      {/* Community header — a compact dark-ink banner. The ink is the app's
          own charcoal (hue 220 @ ~10% saturation → reads gray, not blue) so
          it carries real contrast against the cream/ink app chrome while
          staying on-brand. Deliberately dark in both themes (a hero band).
          A faint pickleball-court watermark adds depth without noise. */}
      {isVenueGroup && <div
        className={cn("venue-community-toolbar relative overflow-hidden shrink-0 px-3 sm:px-4 pb-3.5 [padding-top:calc(0.6rem+env(safe-area-inset-top))]", isVenueGroup && "venue-brand-chrome")}
        style={{
          // PULSE ink band — same ink ramp as the rest of the app chrome
          // (hsl 220 10%), finished with a gold hairline. A venue community
          // swaps the two colours that carry identity — the band and the
          // hairline — and keeps the composition, so every venue still reads
          // as the same product.
          backgroundColor: isVenueGroup ? 'var(--venue-header)' : undefined,
          backgroundImage: isVenueGroup ? undefined :
            chrome?.backgroundImage ??
            'linear-gradient(158deg, hsl(var(--ink-700)) 0%, hsl(var(--ink-900)) 60%, hsl(220 12% 8%) 100%)',
          borderBottom: `1px solid ${chrome?.border ?? 'hsl(var(--primary) / 0.28)'}`,
        }}
      >
        {/* Gold hairline + ambient bloom — broadcast framing. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{
            background: `linear-gradient(90deg, transparent, ${
              chrome?.accent ?? 'hsl(var(--primary) / 0.9)'
            }, transparent)`,
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-20 h-52 w-52 rounded-full blur-3xl"
          style={{ background: chrome?.bloom ?? 'hsl(var(--primary) / 0.16)' }}
        />
        {/* Court-line watermark — bleeds off the top-right corner. */}
        <svg
          aria-hidden
          viewBox="0 0 200 300"
          className="pointer-events-none absolute -right-8 -top-6 h-[150%] w-auto text-white opacity-[0.055]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <rect x="20" y="20" width="160" height="260" rx="3" />
          <line x1="20" y1="150" x2="180" y2="150" />
          <line x1="20" y1="108" x2="180" y2="108" />
          <line x1="20" y1="192" x2="180" y2="192" />
          <line x1="100" y1="20" x2="100" y2="108" />
          <line x1="100" y1="192" x2="100" y2="280" />
        </svg>

        <div className="relative flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 -ml-0.5 shrink-0 rounded-full border border-white/15 text-white/90 hover:text-white hover:bg-white/10"
            onClick={communityReturn.goBack}
            aria-label={`Back to ${communityReturn.label}`}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <CommunityBrandMark group={group} className="h-8 w-8 text-[32px] ring-1 ring-white/20 lg:h-9 lg:w-9 lg:text-[36px]" />

          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold truncate leading-tight text-white">
              {group.name}
            </h1>
            {isVenueGroup && <p className="mt-1 flex items-center gap-1 text-xs text-white/75">{group.is_venue_verified && <BadgeCheck className="h-3.5 w-3.5" />}{group.is_venue_verified ? 'Verified venue community' : 'Venue community'}</p>}
            {isVenueGroup && group.venue?.tagline ? (
              <p className="mt-0.5 truncate text-xs text-white/70">{group.venue.tagline}</p>
            ) : (
              <div
                className="h-[3px] w-10 mt-1.5 rounded-full"
                style={{ background: chrome?.accent ?? 'hsl(var(--primary))' }}
              />
            )}
          </div>

          {/* Right-side action cluster — white on the dark band. */}
          <div className="flex items-center gap-0.5 shrink-0 text-white/85">
            {(group.invite_code || group.visibility === 'public') && (
              <Button
                variant="ghost"
                size="icon"
                className="h-11 w-11 rounded-full text-white/85 hover:text-white hover:bg-white/10"
                onClick={() => setInviteModalOpen(true)}
                aria-label={`Share ${group.name}`}
              >
                <Share2 className="h-[18px] w-[18px]" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={cn('h-10 w-10 rounded-full text-white/85 hover:text-white hover:bg-white/10', isVenueGroup && 'hidden lg:inline-flex')} aria-label="Create">
                  <Plus className="h-[18px] w-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openQuickPost('post')}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Post Update
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTabChange('schedule')}>
                  <Calendar className="h-4 w-4 mr-2" />
                  Create Event
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openQuickPost('poll')}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Create Poll
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-white/85 hover:text-white hover:bg-white/10" aria-label="More">
                  <MoreVertical className="h-[18px] w-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isVenueGroup && <>
                  <DropdownMenuItem className="min-h-11 lg:hidden" onClick={() => openQuickPost('post')}><MessageSquare className="mr-2 h-4 w-4" />Post update</DropdownMenuItem>
                  <DropdownMenuItem className="min-h-11 lg:hidden" onClick={() => handleTabChange('schedule')}><Calendar className="mr-2 h-4 w-4" />Create event</DropdownMenuItem>
                  <DropdownMenuItem className="min-h-11 lg:hidden" onClick={() => openQuickPost('poll')}><MessageSquare className="mr-2 h-4 w-4" />Create poll</DropdownMenuItem>
                </>}
                {(group.invite_code || group.visibility === 'public') && (
                  <DropdownMenuItem onClick={() => setInviteModalOpen(true)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share invite
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setNotifSettingsOpen(true)}>
                  <Bell className="h-4 w-4 mr-2" />
                  Notifications
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleTabChange('more')}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Files
                </DropdownMenuItem>
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate(`/player/community/group/${groupId}/manage`)}>
                    <Settings className="h-4 w-4 mr-2" />
                    Group Settings
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>}

      {/* Tab strip — sliding-underline pattern (matches MatchHistory,
          RoundRobinDetail, Community.tsx). Pre-overhaul each TabsTrigger
          had its own per-tab border-bottom which read as five disjoint
          underline states; the single sliding bar reads as one nav
          element with continuous motion. The radix TabsList stays
          mounted as sr-only so keyboard/screen-reader semantics are
          preserved — clicks still flow through the underlying Tabs
          value to drive TabsContent visibility. Venue-branded groups
          override the underline color to the venue accent inline. */}
      <Tabs value={activeTab} onValueChange={handleTabChange} orientation={!isVenueGroup && !mobile ? 'vertical' : 'horizontal'} className={isVenueGroup ? 'flex-1 flex flex-col overflow-hidden' : 'club-body'}>
        {!isVenueGroup && <ClubhouseNavigation chatEnabled={groupSettings.chat_enabled} description={group.description} subtitle={subtitle} onlineCount={onlineCount} connected={isConnected} onTabChange={handleTabChange} />}
        {isVenueGroup && <div
          className="venue-community-nav border-b border-border/30 bg-background shrink-0 relative"
          style={
            chrome?.accentHex ? { borderColor: `${chrome.accentHex}20` } : undefined
          }
        >
          <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map((tab) => {
              const active = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => handleTabChange(tab.value)}
                  className={cn(
                    'relative h-14 flex flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium transition-colors duration-200',
                    active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                  )}
                  style={isVenueGroup && active ? { color: venueColor || undefined } : undefined}
                  aria-current={active ? 'page' : undefined}
                >
                  <tab.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          {/* Sliding underline — index-driven width/left so adding a
              tab is one array entry rather than per-tab branches.
              Honors venueColor for branded groups. */}
          {(() => {
            const idx = Math.max(0, tabs.findIndex((t) => t.value === activeTab));
            const w = 100 / tabs.length;
            return (
              <div
                aria-hidden
                className="absolute bottom-0 h-[2px] bg-primary rounded-full transition-all duration-[240ms] ease-out"
                style={{
                  width: `${w}%`,
                  left: `${w * idx}%`,
                  ...(isVenueGroup ? { backgroundColor: venueColor || undefined } : null),
                }}
              />
            );
          })()}
          {/* Keep the Radix TabsList in the tree so the a11y / keyboard
              wiring still works — visually hidden via sr-only. */}
          <TabsList className="sr-only">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>
        </div>}

        {/* Content Area - Lazy mounted tabs */}
        <div className={cn('min-h-0 min-w-0 flex-1 overflow-hidden', !isVenueGroup && 'club-content')}>
          {/* Feed Tab - Always mounted first */}
          <TabsContent 
            value="feed" 
            className={cn(
              "h-full m-0 overflow-y-auto p-4",
              !isVenueGroup && 'club-panel',
              activeTab !== 'feed' && "hidden"
            )}
            forceMount={visitedTabs.has('feed') ? true : undefined}
          >
            {visitedTabs.has('feed') && (
              <div className="space-y-4">
                {!isVenueGroup && <>
                  <div className="club-panel-heading"><div><h2>The community board</h2><p>Good games start with a conversation.</p></div></div>
                  {abilities.post && <button className="club-composer" onClick={() => openQuickPost('post')}><span><Plus className="h-5 w-5" /></span><span className="min-w-0"><span className="text-sm font-semibold">What’s happening, {currentUserProfile?.display_name || currentUserProfile?.first_name || 'player'}?</span><small>Share an update, a photo or a poll.</small></span></button>}
                </>}
                {isVenueGroup && group.venue?.cover_image_url && <div className="relative h-[6.25rem] overflow-hidden rounded-xl bg-[#171a1f] lg:hidden"><VenueCoverImage src={group.venue.cover_image_url} fit={group.venue.cover_image_fit} crop={group.venue.cover_crop} focalPoint={group.venue.cover_focal_point} alt={`${group.name} banner`} /></div>}
                {membership && (
                  <EnablePushBanner
                    dismissKey={`pulse.enablePushBanner.group.${groupId}`}
                    contextLabel={group.name}
                  />
                )}
                {isVenueGroup && (
                  <VenueWelcome
                    headline={group.venue?.welcome_headline ?? null}
                    message={group.venue?.welcome_message ?? null}
                    accent={chrome?.accentHex ?? null}
                  />
                )}
                <GroupFeed 
                  groupId={groupId!} 
                  groupName={group.name}
                  isAdmin={isAdmin} 
                  currentUserId={currentUserId}
                  onOpenQuickPost={abilities.post ? (type) => openQuickPost(type as PostType) : undefined}
                  onSwitchToEvents={() => handleTabChange('schedule')}
                />
              </div>
            )}
          </TabsContent>

          {/* Schedule Tab */}
          <TabsContent 
            value="schedule" 
            className={cn(
              "h-full m-0 overflow-y-auto p-4",
              !isVenueGroup && 'club-panel',
              activeTab !== 'schedule' && "hidden"
            )}
            forceMount={visitedTabs.has('schedule') ? true : undefined}
          >
            {visitedTabs.has('schedule') && (
              <div>
                {!isVenueGroup && <div className="club-panel-heading"><div><h2>See you on court</h2><p>Your community’s calendar. Find a game and save your spot.</p></div></div>}
                <GroupSchedule groupId={groupId!} isAdmin={isAdmin} currentUserId={currentUserId} canCreateEvent={abilities.event} />
              </div>
            )}
          </TabsContent>

          {/* Chat Tab */}
          <TabsContent 
            value="chat" 
            className={cn(
              "h-full m-0 flex flex-col",
              activeTab !== 'chat' && "hidden"
            )}
            forceMount={visitedTabs.has('chat') ? true : undefined}
          >
            {visitedTabs.has('chat') && abilities.chat && (
              <GroupChat
                groupId={groupId!}
                currentUserId={currentUserId}
                onlineCount={onlineCount}
                isConnected={isConnected}
                isAdmin={isAdmin}
                lastReadAt={membership?.last_chat_read_at ?? membership?.last_read_at ?? null}
                isActive={activeTab === 'chat'}
                canSendMessages={canSendChat}
              />
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent 
            value="members" 
            className={cn(
              "h-full m-0 overflow-y-auto p-4",
              !isVenueGroup && 'club-panel',
              activeTab !== 'members' && "hidden"
            )}
            forceMount={visitedTabs.has('members') ? true : undefined}
          >
            {visitedTabs.has('members') && (
              <div>
              {!isVenueGroup && <div className="club-panel-heading"><div><h2>Your people</h2><p>Find familiar faces and your next playing partner.</p></div></div>}
              <GroupMembers
                groupId={groupId!} 
                isAdmin={isAdmin} 
                isOwner={membership?.role === 'owner'} 
                currentUserId={currentUserId}
                onInviteClick={group.invite_code || group.visibility === 'public' ? () => setInviteModalOpen(true) : undefined}
                isOnline={isOnline}
              />
              </div>
            )}
          </TabsContent>

          {/* More Tab — Files + group utilities */}
          <TabsContent 
            value="more" 
            className={cn(
              "h-full m-0 overflow-y-auto p-4 space-y-6",
              !isVenueGroup && 'club-panel',
              activeTab !== 'more' && "hidden"
            )}
            forceMount={visitedTabs.has('more') ? true : undefined}
          >
            {visitedTabs.has('more') && (
              <>
                {/* About — the group's visibility/type/size and live presence,
                    relocated here from the header to reclaim headspace. */}
                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-1">
                    About
                  </div>
                  <div className="rounded-xl border border-border/40 bg-card p-4 space-y-3">
                    {isVenueGroup && <div className="space-y-1 lg:hidden"><p className="flex items-center gap-1 text-sm font-medium">{group.is_venue_verified && <BadgeCheck className="h-4 w-4" />}{group.is_venue_verified ? 'Verified venue community' : 'Venue community'}</p>{group.venue?.tagline && <p className="text-sm text-muted-foreground">{group.venue.tagline}</p>}</div>}
                    <div className="flex items-center gap-2 text-sm text-foreground">
                      <VisibilityIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span>{subtitle}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="relative flex h-2 w-2">
                        {isConnected && (
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500/60 opacity-75" />
                        )}
                        <span className={cn(
                          "relative inline-flex rounded-full h-2 w-2",
                          isConnected ? "bg-emerald-500" : "bg-muted-foreground/40"
                        )} />
                      </span>
                      <span className="text-muted-foreground">
                        {onlineCount > 0 ? `${onlineCount} active now` : 'No one active right now'}
                      </span>
                    </div>
                    {group.description && (
                      <p className="text-sm text-muted-foreground leading-relaxed pt-1 border-t border-border/30">
                        {group.description}
                      </p>
                    )}
                  </div>
                </div>

                {abilities.files && <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span className="font-medium uppercase tracking-wide">Files</span>
                  </div>
                  <GroupFiles groupId={groupId!} isAdmin={isAdmin} currentUserId={currentUserId} canUpload={abilities.upload} />
                </div>}

                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-1">
                    Community
                  </div>
                  <div className="rounded-xl border border-border/40 bg-card divide-y divide-border/30 overflow-hidden">
                    <button onClick={() => setNotifSettingsOpen(true)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"><Bell className="h-4 w-4 text-muted-foreground" /><span className="text-sm">Notification preferences</span></button>
                    {(group.invite_code || group.visibility === 'public') && (
                      <button
                        onClick={() => setInviteModalOpen(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                      >
                        <Share2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Share invite link</span>
                      </button>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => navigate(`/player/community/group/${groupId}/manage`)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                      >
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Group settings</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </TabsContent>
        </div>
      </Tabs>

      {/* Invite Modal */}
      <InviteModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        inviteCode={group.invite_code}
        shareUrl={group.visibility === 'public' ? communityUrl(group.id) : undefined}
        groupName={group.name}
      />

      <GroupNotificationSettingsSheet
        open={notifSettingsOpen}
        onOpenChange={setNotifSettingsOpen}
        groupId={group.id}
        groupName={group.name}
      />

      {/* Collapsed Composer Bar - Only show on Feed tab */}
      {activeTab === 'feed' && isVenueGroup && abilities.post && (
        <CollapsedComposerBar
          embedded={isVenueGroup}
          onExpand={() => openQuickPost('post')}
          onPhotoClick={() => openQuickPost('photo')}
          avatarUrl={currentUserProfile?.avatar_url}
          displayName={currentUserProfile?.display_name || currentUserProfile?.full_name}
        />
      )}

      {/* Quick Post Composer (Drawer) */}
      <QuickPostComposer
        open={quickPostOpen && abilities.post}
        onOpenChange={setQuickPostOpen}
        initialType={quickPostType}
        groupId={groupId || ''}
        contextName={group.name}
        canPostLfg={abilities.lfg}
        onSubmit={handleQuickPost}
      />
    </div>
  );
}
