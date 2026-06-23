import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Settings, Users, MessageSquare, MessageCircle, Calendar, 
  FolderOpen, Plus, Share2, MoreVertical, MoreHorizontal, Building2, UserPlus
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { Group, GroupMember } from '@/hooks/useGroups';
import { GroupFeed } from '@/components/community/GroupFeed';
import { GroupSchedule } from '@/components/community/GroupSchedule';
import { GroupFiles } from '@/components/community/GroupFiles';
import { GroupMembers } from '@/components/community/GroupMembers';
import { GroupChat } from '@/components/community/GroupChat';
import { InviteModal } from '@/components/community/InviteModal';
import { QuickPostComposer, type PostType } from '@/components/community/QuickPostComposer';
import { CollapsedComposerBar } from '@/components/community/CollapsedComposerBar';
import { useGroupPosts } from '@/hooks/useGroupPosts';
import { useGroupPresence } from '@/hooks/useGroupPresence';
import { useGroupRealtime } from '@/hooks/useGroupRealtime';
import { EnablePushBanner } from '@/components/dashboard/EnablePushBanner';


import { DEFAULT_VENUE_COLORS } from '@/lib/venueBranding';

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<GroupMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('feed');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ display_name: string | null; full_name: string | null; avatar_url: string | null } | null>(null);
  
  // Track which tabs have been visited for lazy mounting
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['feed']));
  
  // Modal states
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [quickPostOpen, setQuickPostOpen] = useState(false);
  const [quickPostType, setQuickPostType] = useState<PostType>('post');

  const { createPost } = useGroupPosts(groupId || '');
  
  // Single presence subscription at parent level
  const presence = useGroupPresence(groupId);
  const { onlineCount, isConnected, isOnline } = presence;
  
  // Single realtime subscription for all group data
  useGroupRealtime(groupId);

  // Handle tab changes with lazy mounting
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    setVisitedTabs(prev => {
      if (prev.has(tab)) return prev;
      return new Set([...prev, tab]);
    });
  }, []);

  useEffect(() => {
    if (groupId) {
      fetchGroupData();
    }
  }, [groupId]);

  const fetchGroupData = async () => {
    if (!groupId) return;
    
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setCurrentUserId(user.id);

      // Fetch current user profile for composer avatar
      supabase
        .from('profiles')
        .select('display_name, full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setCurrentUserProfile(data);
        });

      // Fetch group with venue relationship for venue_official groups
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select(`
          *,
          venues:venue_id (
            id,
            name,
            slug,
            logo_url,
            primary_color,
            secondary_color
          )
        `)
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      
      // Map venues to venue for consistency with type
      const groupWithVenue = {
        ...groupData,
        venue: groupData.venues || null
      };
      setGroup(groupWithVenue);

      // Fetch membership
      const { data: membershipData } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', user.id)
        .single();

      setMembership(membershipData);

      // Update last_read_at
      if (membershipData) {
        await supabase
          .from('group_members')
          .update({ last_read_at: new Date().toISOString() })
          .eq('id', membershipData.id);
      }
    } catch (error) {
      console.error('Error fetching group:', error);
      toast({
        title: 'Error',
        description: 'Failed to load group',
        variant: 'destructive',
      });
      navigate('/player/community');
    } finally {
      setLoading(false);
    }
  };

  const openQuickPost = useCallback((type: PostType) => {
    setQuickPostType(type);
    setQuickPostOpen(true);
  }, []);

  const handleQuickPost = useCallback(async (data: any) => {
    const result = await createPost(data);
    return !!result;
  }, [createPost]);

  const isAdmin = membership?.role === 'owner' || membership?.role === 'moderator';
  
  // Venue branding for venue_official groups
  const isVenueGroup = group?.type === 'venue_official' && group?.is_venue_verified && group?.venue;
  const venueColor = isVenueGroup ? (group.venue?.primary_color || DEFAULT_VENUE_COLORS.primary) : null;

  // Memoize tab config — labeled tabs with More holding Files/Settings
  const tabs = useMemo(() => [
    { value: 'feed', icon: MessageSquare, label: 'Feed' },
    { value: 'schedule', icon: Calendar, label: 'Events' },
    { value: 'chat', icon: MessageCircle, label: 'Chat' },
    { value: 'members', icon: Users, label: 'Members' },
    { value: 'more', icon: MoreHorizontal, label: 'More' },
  ], []);

  // Human-readable subtitle: "{Visibility} {Type} · N members"
  const typeLabel = useMemo(() => {
    const map: Record<string, string> = {
      crew: 'Crew',
      league: 'League',
      open_play: 'Open Play',
      venue_official: 'Venue',
      tournament: 'Tournament',
    };
    return group ? (map[group.type] || 'Group') : 'Group';
  }, [group]);
  const visibilityLabel = group?.visibility === 'private'
    ? 'Private'
    : group?.visibility === 'unlisted' ? 'Unlisted' : 'Public';
  const memberCount = group?.member_count ?? 0;
  const subtitle = `${visibilityLabel} ${typeLabel} · ${memberCount} ${memberCount === 1 ? 'member' : 'members'}`;

  if (loading) {
    return (
      <div className="px-4 py-4 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="px-4 py-12 text-center">
        <h2 className="text-lg font-medium">Group not found</h2>
        <Button onClick={() => navigate('/player/community')} variant="outline" size="sm" className="mt-4">
          Back to Community
        </Button>
      </div>
    );
  }

  return (
    <div 
      className="flex flex-col h-[100dvh]"
      style={isVenueGroup ? {
        '--venue-primary': venueColor,
      } as React.CSSProperties : undefined}
    >
      {/* Refined Community Header — matches PlayerPageHeader (Match page) treatment */}
      <div
        className={cn(
          "px-3 sm:px-4 pt-3 pb-3 border-b border-border/40 shrink-0",
          !isVenueGroup && "bg-gradient-to-b from-primary/[0.10] via-primary/[0.03] to-background"
        )}
        style={isVenueGroup ? {
          borderColor: `${venueColor}30`,
          background: `linear-gradient(to bottom, ${venueColor}14, ${venueColor}06, transparent)`
        } : undefined}
      >
        <div className="flex items-start gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 -ml-1 shrink-0"
            onClick={() => navigate('/player/community')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1 min-w-0 pt-0.5">
            <h1 className="text-lg sm:text-xl font-semibold truncate leading-tight text-foreground">
              {group.name}
            </h1>
            <div
              className="h-[3px] w-10 mt-1.5 rounded-full bg-primary"
              style={isVenueGroup ? { background: venueColor || undefined } : undefined}
            />
            <p className="text-xs text-muted-foreground mt-1.5 truncate">
              {subtitle}
            </p>
            {/* Active indicator — readable, not a mystery dot */}
            <div className="flex items-center gap-1.5 mt-1">
              <span className="relative flex h-2 w-2">
                {isConnected && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500/60 opacity-75" />
                )}
                <span className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  isConnected ? "bg-emerald-500" : "bg-muted-foreground/40"
                )} />
              </span>
              <span className="text-xs text-muted-foreground">
                {onlineCount > 0 ? `${onlineCount} active` : 'Idle'}
              </span>
            </div>
          </div>

          {/* Right-side action cluster */}
          <div className="flex items-center gap-0.5 shrink-0">
            {group.invite_code && (
              <Button 
                variant="ghost" 
                size="icon"
                className="h-9 w-9"
                onClick={() => setInviteModalOpen(true)}
                aria-label="Invite"
              >
                <UserPlus className="h-[18px] w-[18px]" />
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="Create">
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
                <Button variant="ghost" size="icon" className="h-9 w-9" aria-label="More">
                  <MoreVertical className="h-[18px] w-[18px]" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {group.invite_code && (
                  <DropdownMenuItem onClick={() => setInviteModalOpen(true)}>
                    <Share2 className="h-4 w-4 mr-2" />
                    Share invite
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => handleTabChange('more')}>
                  <FolderOpen className="h-4 w-4 mr-2" />
                  Files
                </DropdownMenuItem>
                {isVenueGroup && group.venue?.slug && (
                  <DropdownMenuItem onClick={() => navigate(`/v/${group.venue!.slug}`)}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Visit Venue
                  </DropdownMenuItem>
                )}
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
      </div>

      {/* Labeled Tab Bar */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="flex-1 flex flex-col overflow-hidden">
        <div 
          className="border-b border-border/30 bg-background shrink-0"
          style={isVenueGroup ? { borderColor: `${venueColor}20` } : undefined}
        >
          <TabsList className="h-14 bg-transparent p-0 w-full justify-between gap-0 rounded-none">
            {tabs.map((tab) => {
              const active = activeTab === tab.value;
              return (
                <TabsTrigger 
                  key={tab.value}
                  value={tab.value} 
                  className={cn(
                    "flex-1 h-14 rounded-none border-b-2 border-transparent bg-transparent",
                    "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                    "flex flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
                    active ? "text-primary" : "text-muted-foreground"
                  )}
                  style={isVenueGroup && active ? {
                    borderColor: venueColor || undefined,
                    color: venueColor || undefined
                  } : undefined}
                >
                  <tab.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.25 : 1.75} />
                  <span>{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Content Area - Lazy mounted tabs */}
        <div className="flex-1 overflow-hidden">
          {/* Feed Tab - Always mounted first */}
          <TabsContent 
            value="feed" 
            className={cn(
              "h-full m-0 overflow-y-auto p-4",
              activeTab !== 'feed' && "hidden"
            )}
            forceMount={visitedTabs.has('feed') ? true : undefined}
          >
            {visitedTabs.has('feed') && (
              <div className="space-y-4">
                {membership && (
                  <EnablePushBanner
                    dismissKey={`pulse.enablePushBanner.group.${groupId}`}
                    contextLabel={group.name}
                  />
                )}
                <GroupFeed 
                  groupId={groupId!} 
                  groupName={group.name}
                  isAdmin={isAdmin} 
                  currentUserId={currentUserId}
                  onOpenQuickPost={(type) => openQuickPost(type as PostType)}
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
              activeTab !== 'schedule' && "hidden"
            )}
            forceMount={visitedTabs.has('schedule') ? true : undefined}
          >
            {visitedTabs.has('schedule') && (
              <GroupSchedule groupId={groupId!} isAdmin={isAdmin} currentUserId={currentUserId} />
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
            {visitedTabs.has('chat') && (
              <GroupChat
                groupId={groupId!}
                currentUserId={currentUserId}
                onlineCount={onlineCount}
                isConnected={isConnected}
                isAdmin={isAdmin}
                lastReadAt={membership?.last_read_at ?? null}
              />
            )}
          </TabsContent>

          {/* Members Tab */}
          <TabsContent 
            value="members" 
            className={cn(
              "h-full m-0 overflow-y-auto p-4",
              activeTab !== 'members' && "hidden"
            )}
            forceMount={visitedTabs.has('members') ? true : undefined}
          >
            {visitedTabs.has('members') && (
              <GroupMembers 
                groupId={groupId!} 
                isAdmin={isAdmin} 
                isOwner={membership?.role === 'owner'} 
                currentUserId={currentUserId}
                onInviteClick={() => setInviteModalOpen(true)}
                isOnline={isOnline}
              />
            )}
          </TabsContent>

          {/* More Tab — Files + group utilities */}
          <TabsContent 
            value="more" 
            className={cn(
              "h-full m-0 overflow-y-auto p-4 space-y-6",
              activeTab !== 'more' && "hidden"
            )}
            forceMount={visitedTabs.has('more') ? true : undefined}
          >
            {visitedTabs.has('more') && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-1">
                    <FolderOpen className="h-3.5 w-3.5" />
                    <span className="font-medium uppercase tracking-wide">Files</span>
                  </div>
                  <GroupFiles groupId={groupId!} isAdmin={isAdmin} currentUserId={currentUserId} />
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-1">
                    Community
                  </div>
                  <div className="rounded-xl border border-border/40 bg-card divide-y divide-border/30 overflow-hidden">
                    {group.invite_code && (
                      <button
                        onClick={() => setInviteModalOpen(true)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                      >
                        <Share2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Share invite link</span>
                      </button>
                    )}
                    {isVenueGroup && group.venue?.slug && (
                      <button
                        onClick={() => navigate(`/v/${group.venue!.slug}`)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors"
                      >
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">Visit venue page</span>
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
        groupName={group.name}
      />

      {/* Collapsed Composer Bar - Only show on Feed tab */}
      {activeTab === 'feed' && (
        <CollapsedComposerBar
          onExpand={() => openQuickPost('post')}
          onPhotoClick={() => openQuickPost('photo')}
          avatarUrl={currentUserProfile?.avatar_url}
          displayName={currentUserProfile?.display_name || currentUserProfile?.full_name}
        />
      )}

      {/* Quick Post Composer (Drawer) */}
      <QuickPostComposer
        open={quickPostOpen}
        onOpenChange={setQuickPostOpen}
        initialType={quickPostType}
        groupId={groupId || ''}
        onSubmit={handleQuickPost}
      />
    </div>
  );
}
