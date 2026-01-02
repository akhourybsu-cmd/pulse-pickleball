import { useState } from 'react';
import { Plus, Key, Users, Search, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupCard } from '@/components/community/GroupCard';
import { CreateGroupDialog } from '@/components/community/CreateGroupDialog';
import { JoinGroupDialog } from '@/components/community/JoinGroupDialog';
import { CommunityActivityFeed } from '@/components/community/CommunityActivityFeed';
import { useGroups } from '@/hooks/useGroups';

export default function Community() {
  const { myGroups, publicGroups, loading, createGroup, joinGroupByCode, joinPublicGroup } = useGroups();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('my-groups');
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  const handleJoinPublicGroup = async (groupId: string) => {
    setJoiningGroupId(groupId);
    await joinPublicGroup(groupId);
    setJoiningGroupId(null);
  };

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Community</h1>
        <p className="text-muted-foreground">Your groups, your people.</p>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => setJoinDialogOpen(true)} variant="outline" className="gap-2">
          <Key className="h-4 w-4" />
          Enter Group Code
        </Button>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Group
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="my-groups" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">My Groups</span>
            <span className="sm:hidden">Groups</span>
            {myGroups.length > 0 && (
              <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {myGroups.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="discover" className="gap-2">
            <Search className="h-4 w-4" />
            Discover
          </TabsTrigger>
          <TabsTrigger value="activity" className="gap-2">
            <Activity className="h-4 w-4" />
            Activity
          </TabsTrigger>
        </TabsList>

        {/* My Groups Tab */}
        <TabsContent value="my-groups" className="space-y-5 mt-2">
          {loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : myGroups.length > 0 ? (
            <div className="space-y-4">
              {myGroups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No groups yet</h3>
                <p className="text-muted-foreground mb-6 max-w-sm">
                  Join a group with a code or create your own to connect with other players.
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Button onClick={() => setJoinDialogOpen(true)} variant="outline" className="gap-2">
                    <Key className="h-4 w-4" />
                    Join with Code
                  </Button>
                  <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Create Group
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Discover Tab */}
        <TabsContent value="discover" className="space-y-5 mt-2">
          {publicGroups.length > 0 ? (
            <>
              <p className="text-sm text-muted-foreground/70">
                Public groups you can join
              </p>
              <div className="space-y-4">
                {publicGroups.map((group) => {
                  const isAlreadyMember = myGroups.some(g => g.id === group.id);
                  return (
                    <GroupCard 
                      key={group.id} 
                      group={{
                        ...group,
                        membership: isAlreadyMember ? myGroups.find(g => g.id === group.id)?.membership : undefined,
                        unread_count: 0,
                      }}
                      showJoinButton={!isAlreadyMember}
                      onJoin={handleJoinPublicGroup}
                      isJoining={joiningGroupId === group.id}
                    />
                  );
                })}
              </div>
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No public groups</h3>
                <p className="text-muted-foreground max-w-sm">
                  There are no public groups to discover right now. Check back later or create your own!
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="mt-2">
          <CommunityActivityFeed />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <CreateGroupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={createGroup}
      />
      <JoinGroupDialog
        open={joinDialogOpen}
        onOpenChange={setJoinDialogOpen}
        onJoin={joinGroupByCode}
      />
    </div>
  );
}
