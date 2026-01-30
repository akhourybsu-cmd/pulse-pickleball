import { useState } from 'react';
import { Plus, Key, Users, Search, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupCard } from '@/components/community/GroupCard';
import { ReorderableGroupList } from '@/components/community/ReorderableGroupList';
import { CreateGroupDialog } from '@/components/community/CreateGroupDialog';
import { JoinGroupDialog } from '@/components/community/JoinGroupDialog';
import { CommunityActivityFeed } from '@/components/community/CommunityActivityFeed';
import { useGroups } from '@/hooks/useGroups';

export default function Community() {
  const { myGroups, publicGroups, loading, createGroup, joinGroupByCode, joinPublicGroup, updateGroupOrder } = useGroups();
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
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <h1 className="text-lg font-semibold">Community</h1>
        <div className="flex items-center gap-2">
          <Button 
            onClick={() => setJoinDialogOpen(true)} 
            variant="ghost" 
            size="sm"
            className="h-8 px-3 text-xs"
          >
            <Key className="h-3.5 w-3.5 mr-1.5" />
            <span className="hidden sm:inline">Enter Code</span>
          </Button>
          <Button 
            onClick={() => setCreateDialogOpen(true)} 
            size="sm"
            className="h-8 px-3 text-xs"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create
          </Button>
        </div>
      </div>

      {/* Slim Inline Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="border-b border-border/30 px-4">
          <TabsList className="h-10 bg-transparent p-0 gap-4">
            <TabsTrigger 
              value="my-groups" 
              className="h-10 px-0 pb-0 pt-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm"
            >
              <Users className="h-3.5 w-3.5 mr-1.5" />
              Groups
              {myGroups.length > 0 && (
                <span className="ml-1.5 text-xs text-muted-foreground">
                  {myGroups.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="discover" 
              className="h-10 px-0 pb-0 pt-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm"
            >
              <Search className="h-3.5 w-3.5 mr-1.5" />
              Discover
            </TabsTrigger>
            <TabsTrigger 
              value="activity" 
              className="h-10 px-0 pb-0 pt-1 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none text-sm"
            >
              <Activity className="h-3.5 w-3.5 mr-1.5" />
              Activity
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Full-height scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* My Groups Tab */}
          <TabsContent value="my-groups" className="m-0 p-4 space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : myGroups.length > 0 ? (
              <ReorderableGroupList 
                groups={myGroups} 
                onReorder={updateGroupOrder} 
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Users className="h-5 w-5 text-muted-foreground/70" />
                </div>
                <h3 className="text-base font-medium mb-1">No groups yet</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
                  Join with a code or create your own group
                </p>
                <div className="flex gap-2">
                  <Button onClick={() => setJoinDialogOpen(true)} variant="outline" size="sm">
                    Join
                  </Button>
                  <Button onClick={() => setCreateDialogOpen(true)} size="sm">
                    Create
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Discover Tab */}
          <TabsContent value="discover" className="m-0 p-4 space-y-3">
            {publicGroups.length > 0 ? (
              <>
                <p className="text-xs text-muted-foreground/70 mb-3">
                  Public groups you can join
                </p>
                <div className="space-y-3">
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
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <Search className="h-5 w-5 text-muted-foreground/70" />
                </div>
                <h3 className="text-base font-medium mb-1">No public groups</h3>
                <p className="text-sm text-muted-foreground max-w-[280px]">
                  Check back later or create your own group
                </p>
              </div>
            )}
          </TabsContent>

          {/* Activity Tab */}
          <TabsContent value="activity" className="m-0 p-4">
            <CommunityActivityFeed />
          </TabsContent>
        </div>
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
