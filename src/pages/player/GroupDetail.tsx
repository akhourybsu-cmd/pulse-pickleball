import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, Settings, Users, MessageSquare, MessageCircle, Calendar, 
  FolderOpen, Gamepad2, Lock, Globe, Eye, Plus, Share2, MoreVertical, Info
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
import { GroupLFG } from '@/components/community/GroupLFG';
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
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-xl font-semibold">Group not found</h2>
        <Button onClick={() => navigate('/player/community')} className="mt-4">
          Back to Community
        </Button>
      </div>
    );
  }

  const visibilityIcon = group.visibility === 'private'
    ? <Lock className="h-4 w-4" />
    : group.visibility === 'unlisted'
    ? <Eye className="h-4 w-4" />
    : <Globe className="h-4 w-4" />;

  const visibilityLabel = group.visibility === 'private' 
    ? 'Private Group' 
    : group.visibility === 'unlisted' 
    ? 'Unlisted Group' 
    : 'Public Group';

  return (
    <div className="container max-w-4xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/player/community')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight line-clamp-2 leading-tight">{group.name}</h1>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-1">
          {group.invite_code && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setInviteModalOpen(true)}
            >
              <Share2 className="h-5 w-5" />
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <Plus className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openQuickPost('post')}>
                <MessageSquare className="h-4 w-4 mr-2" />
                Post Update
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => openQuickPost('lfg')}>
                <Gamepad2 className="h-4 w-4 mr-2" />
                Looking for Game
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
                <Button variant="ghost" size="icon">
                  <MoreVertical className="h-5 w-5" />
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

      {/* About Strip with Details Drawer */}
      <div className="flex items-center gap-2 text-sm">
        <Popover>
          <PopoverTrigger asChild>
            <Badge 
              variant="outline" 
              className="text-xs cursor-pointer hover:bg-muted gap-1 transition-colors"
            >
              {group.visibility === 'private' ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
              {group.visibility === 'private' ? 'Private' : group.visibility === 'unlisted' ? 'Unlisted' : 'Public'}
            </Badge>
          </PopoverTrigger>
          <PopoverContent className="w-56 text-sm p-3" align="start">
            <div className="space-y-2">
              <p className="flex justify-between"><span className="text-muted-foreground">Visibility</span><span className="font-medium">{visibilityLabel}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Join</span><span className="font-medium">{group.join_method === 'open' ? 'Anyone' : 'Invite only'}</span></p>
              <p className="flex justify-between"><span className="text-muted-foreground">Invite</span><span className="font-medium">Members can share</span></p>
            </div>
          </PopoverContent>
        </Popover>
        {group.description ? (
          <Drawer>
            <DrawerTrigger asChild>
              <button className="text-muted-foreground hover:text-foreground transition-colors truncate max-w-[200px] sm:max-w-none text-left">
                {group.description}
                <span className="text-primary ml-1">View details</span>
              </button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>{group.name}</DrawerTitle>
                <DrawerDescription>{visibilityLabel}</DrawerDescription>
              </DrawerHeader>
              <div className="px-4 pb-6 space-y-4">
                <div>
                  <h4 className="font-medium mb-1">About</h4>
                  <p className="text-muted-foreground">{group.description || 'No description'}</p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Members</h4>
                  <p className="text-muted-foreground">{group.member_count} members</p>
                </div>
              </div>
            </DrawerContent>
          </Drawer>
        ) : (
          <span className="text-muted-foreground">
            <Users className="h-3.5 w-3.5 inline mr-1" />
            {group.member_count} members
          </span>
        )}
      </div>

      {/* Group Snapshot */}
      <GroupSnapshot 
        members={members}
        onCreateEvent={() => setActiveTab('schedule')}
        onViewFeed={() => {
          setActiveTab('feed');
          setTimeout(() => document.querySelector('textarea')?.focus(), 100);
        }}
        onViewMatches={() => setActiveTab('lfg')}
      />

      {/* Tabs with Labels */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="feed" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 min-h-[44px] data-[state=active]:font-medium">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-sm">Feed</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 min-h-[44px] data-[state=active]:font-medium">
            <Calendar className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-sm">Events</span>
          </TabsTrigger>
          <TabsTrigger value="lfg" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 min-h-[44px] data-[state=active]:font-medium">
            <Gamepad2 className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-sm">LFG</span>
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 min-h-[44px] data-[state=active]:font-medium">
            <MessageCircle className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-sm">Chat</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="flex flex-col sm:flex-row gap-0.5 sm:gap-1.5 py-2 min-h-[44px] data-[state=active]:font-medium">
            <Users className="h-3.5 w-3.5" />
            <span className="text-[10px] sm:text-sm">Members</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-4">
          <GroupFeed groupId={groupId!} isAdmin={isAdmin} currentUserId={currentUserId} />
        </TabsContent>

        <TabsContent value="schedule" className="mt-4">
          <GroupSchedule groupId={groupId!} isAdmin={isAdmin} currentUserId={currentUserId} />
        </TabsContent>

        <TabsContent value="lfg" className="mt-4">
          <GroupLFG groupId={groupId!} isAdmin={isAdmin} currentUserId={currentUserId} />
        </TabsContent>

        <TabsContent value="chat" className="mt-4">
          <GroupChat groupId={groupId!} currentUserId={currentUserId} />
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <GroupMembers 
            groupId={groupId!} 
            isAdmin={isAdmin} 
            isOwner={membership?.role === 'owner'} 
            currentUserId={currentUserId} 
          />
        </TabsContent>
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
