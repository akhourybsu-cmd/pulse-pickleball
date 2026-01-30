import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Settings, Users, MessageSquare, MessageCircle, Calendar, 
  FolderOpen, Lock, Globe, Eye, Plus, Share2, MoreVertical
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';
import type { Group, GroupMember } from '@/hooks/useGroups';
import { GroupFeed } from '@/components/community/GroupFeed';
import { GroupSchedule } from '@/components/community/GroupSchedule';

import { GroupFiles } from '@/components/community/GroupFiles';
import { GroupMembers } from '@/components/community/GroupMembers';
import { GroupChat } from '@/components/community/GroupChat';
import { InviteModal } from '@/components/community/InviteModal';
import { QuickPostComposer, type PostType } from '@/components/community/QuickPostComposer';
import { GroupSnapshot } from '@/components/community/GroupSnapshot';
import { useGroupPosts } from '@/hooks/useGroupPosts';

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<GroupMember | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('feed');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // Modal states
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [quickPostOpen, setQuickPostOpen] = useState(false);
  const [quickPostType, setQuickPostType] = useState<PostType>('post');

  const { createPost } = useGroupPosts(groupId || '');

  // Immersive mode for chat tab
  const isImmersive = activeTab === 'chat';

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

      // Fetch group
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

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

      // Fetch members
      const { data: membersData } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('status', 'active')
        .order('joined_at', { ascending: true });

      // Fetch profiles separately
      const memberUserIds = (membersData || []).map(m => m.user_id);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url')
        .in('id', memberUserIds);

      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

      const membersWithProfiles = (membersData || []).map(m => ({
        ...m,
        profile: profilesMap.get(m.user_id),
      })) as GroupMember[];

      setMembers(membersWithProfiles);
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

  const openQuickPost = (type: PostType) => {
    setQuickPostType(type);
    setQuickPostOpen(true);
  };

  const handleQuickPost = async (data: any) => {
    const result = await createPost(data);
    return !!result;
  };

  const isAdmin = membership?.role === 'owner' || membership?.role === 'moderator';

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

  const visibilityLabel = group.visibility === 'private' 
    ? 'Private Group' 
    : group.visibility === 'unlisted' 
    ? 'Unlisted Group' 
    : 'Public Group';

  return (
    <div className={cn(
      "flex flex-col",
      isImmersive ? "h-[calc(100vh-60px)]" : "min-h-[calc(100vh-120px)]"
    )}>
      {/* Compact Header */}
      <div className={cn(
        "flex items-center gap-2 px-4 border-b border-border/30",
        isImmersive ? "py-2" : "py-3"
      )}>
        <Button 
          variant="ghost" 
          size="icon"
          className="h-8 w-8 -ml-2"
          onClick={() => navigate('/player/community')}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-semibold truncate">{group.name}</h1>
          {!isImmersive && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                {group.visibility === 'private' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {group.visibility}
              </span>
              <span>•</span>
              <span>{group.member_count} members</span>
            </div>
          )}
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1">
          {group.invite_code && (
            <Button 
              variant="ghost" 
              size="icon"
              className="h-8 w-8"
              onClick={() => setInviteModalOpen(true)}
            >
              <Share2 className="h-4 w-4" />
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Plus className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openQuickPost('post')}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Post Update
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setActiveTab('schedule'); }}>
                <Calendar className="h-4 w-4 mr-2" />
                Create Event
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openQuickPost('poll')}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Create Poll
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/player/community/group/${groupId}/manage`)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Group Settings
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Group Snapshot - Hidden in immersive mode */}
      {!isImmersive && (
        <div className="px-4 py-3">
          <GroupSnapshot 
            members={members}
            onCreateEvent={() => setActiveTab('schedule')}
            onViewFeed={() => {
              setActiveTab('feed');
              setTimeout(() => document.querySelector('textarea')?.focus(), 100);
            }}
          />
        </div>
      )}

      {/* Minimal Tab Bar */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border/30 px-2">
          <TabsList className="h-10 bg-transparent p-0 w-full justify-start gap-0">
            {[
              { value: 'feed', icon: MessageSquare, label: 'Feed' },
              { value: 'schedule', icon: Calendar, label: 'Events' },
              { value: 'chat', icon: MessageCircle, label: 'Chat' },
              { value: 'members', icon: Users, label: 'Members' },
              { value: 'files', icon: FolderOpen, label: 'Files' },
            ].map((tab) => (
              <TabsTrigger 
                key={tab.value}
                value={tab.value} 
                className="flex-1 h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none gap-1 text-xs px-2"
              >
                <tab.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-hidden">
          <TabsContent value="feed" className="h-full m-0 overflow-y-auto p-4">
            <GroupFeed groupId={groupId!} isAdmin={isAdmin} currentUserId={currentUserId} />
          </TabsContent>

          <TabsContent value="schedule" className="h-full m-0 overflow-y-auto p-4">
            <GroupSchedule groupId={groupId!} isAdmin={isAdmin} currentUserId={currentUserId} />
          </TabsContent>

          <TabsContent value="chat" className="h-full m-0 flex flex-col">
            <GroupChat groupId={groupId!} currentUserId={currentUserId} />
          </TabsContent>

          <TabsContent value="members" className="h-full m-0 overflow-y-auto p-4">
            <GroupMembers 
              groupId={groupId!} 
              isAdmin={isAdmin} 
              isOwner={membership?.role === 'owner'} 
              currentUserId={currentUserId}
              onInviteClick={() => setInviteModalOpen(true)}
            />
          </TabsContent>

          <TabsContent value="files" className="h-full m-0 overflow-y-auto p-4">
            <GroupFiles groupId={groupId!} isAdmin={isAdmin} currentUserId={currentUserId} />
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

      {/* Quick Post Composer */}
      <QuickPostComposer
        open={quickPostOpen}
        onOpenChange={setQuickPostOpen}
        initialType={quickPostType}
        onSubmit={handleQuickPost}
      />
    </div>
  );
}
