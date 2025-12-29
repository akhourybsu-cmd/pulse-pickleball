import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Settings, Users, MessageSquare, Calendar, FolderOpen, Gamepad2, Lock, Globe, Eye, Crown, Shield, Copy, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import type { Group, GroupMember } from '@/hooks/useGroups';
import { GroupFeed } from '@/components/community/GroupFeed';
import { GroupSchedule } from '@/components/community/GroupSchedule';
import { GroupLFG } from '@/components/community/GroupLFG';
import { GroupFiles } from '@/components/community/GroupFiles';
import { GroupMembers } from '@/components/community/GroupMembers';

export default function GroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [group, setGroup] = useState<Group | null>(null);
  const [membership, setMembership] = useState<GroupMember | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('feed');
  const [codeCopied, setCodeCopied] = useState(false);

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

  const copyInviteCode = async () => {
    if (!group?.invite_code) return;
    
    await navigator.clipboard.writeText(group.invite_code);
    setCodeCopied(true);
    toast({ title: 'Copied!', description: 'Invite code copied to clipboard' });
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const isAdmin = membership?.role === 'owner' || membership?.role === 'moderator';

  if (loading) {
    return (
      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
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

  const typeLabels: Record<string, string> = {
    crew: 'Crew',
    league: 'League',
    open_play: 'Open Play',
    venue_official: 'Venue Official',
    tournament: 'Tournament',
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => navigate('/player/community')}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight truncate">{group.name}</h1>
            {visibilityIcon}
          </div>
          <div className="flex items-center gap-2 mt-1 text-muted-foreground">
            <Badge variant="outline" className="text-xs">
              {typeLabels[group.type]}
            </Badge>
            <span className="text-sm flex items-center gap-1">
              <Users className="h-3 w-3" />
              {group.member_count} members
            </span>
          </div>
        </div>
        {isAdmin && (
          <Button variant="outline" size="icon" onClick={() => navigate(`/player/community/group/${groupId}/manage`)}>
            <Settings className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Description & Invite Code */}
      {(group.description || (isAdmin && group.invite_code)) && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            {group.description && (
              <p className="text-muted-foreground">{group.description}</p>
            )}
            {isAdmin && group.invite_code && (
              <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                <span className="text-sm text-muted-foreground">Invite Code:</span>
                <code className="font-mono text-sm font-semibold text-foreground">
                  {group.invite_code}
                </code>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 ml-auto"
                  onClick={copyInviteCode}
                >
                  {codeCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="feed" className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Feed</span>
          </TabsTrigger>
          <TabsTrigger value="schedule" className="gap-1.5">
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Schedule</span>
          </TabsTrigger>
          <TabsTrigger value="lfg" className="gap-1.5">
            <Gamepad2 className="h-4 w-4" />
            <span className="hidden sm:inline">LFG</span>
          </TabsTrigger>
          <TabsTrigger value="files" className="gap-1.5">
            <FolderOpen className="h-4 w-4" />
            <span className="hidden sm:inline">Files</span>
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-1.5">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
        </TabsList>

        {/* Feed Tab */}
        <TabsContent value="feed" className="mt-6">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <MessageSquare className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
              <p className="text-muted-foreground max-w-sm mb-4">
                Be the first to share an update with the group!
              </p>
              <Button className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Create Post
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="mt-6">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No upcoming events</h3>
              <p className="text-muted-foreground max-w-sm mb-4">
                Schedule a session or event for the group.
              </p>
              <Button className="gap-2">
                <Calendar className="h-4 w-4" />
                Create Event
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* LFG Tab */}
        <TabsContent value="lfg" className="mt-6">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Gamepad2 className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No LFG posts</h3>
              <p className="text-muted-foreground max-w-sm mb-4">
                Looking for a game? Post here to find players.
              </p>
              <Button className="gap-2">
                <Gamepad2 className="h-4 w-4" />
                Post LFG
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Files Tab */}
        <TabsContent value="files" className="mt-6">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No files uploaded</h3>
              <p className="text-muted-foreground max-w-sm mb-4">
                Share documents, images, or other files with the group.
              </p>
              <Button className="gap-2">
                <FolderOpen className="h-4 w-4" />
                Upload File
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members" className="mt-6 space-y-3">
          {members.map((member: any) => {
            const profile = member.profiles;
            const displayName = profile?.display_name || profile?.full_name || 'Unknown';
            const initials = displayName
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <Card key={member.id} className="hover:bg-muted/30 transition-colors">
                <CardContent className="flex items-center gap-3 py-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                    {profile?.avatar_url ? (
                      <img 
                        src={profile.avatar_url} 
                        alt={displayName}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{displayName}</div>
                    <div className="text-xs text-muted-foreground">
                      Joined {new Date(member.joined_at).toLocaleDateString()}
                    </div>
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    {member.role === 'owner' && <Crown className="h-3 w-3" />}
                    {member.role === 'moderator' && <Shield className="h-3 w-3" />}
                    {member.role.charAt(0).toUpperCase() + member.role.slice(1)}
                  </Badge>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
