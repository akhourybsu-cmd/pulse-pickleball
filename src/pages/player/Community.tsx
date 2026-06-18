import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, QrCode, Users, Search, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { PlayerPageHeader } from '@/components/layout/PlayerPageHeader';
import { cn } from '@/lib/utils';
import { GroupCard } from '@/components/community/GroupCard';
import { ReorderableGroupList } from '@/components/community/ReorderableGroupList';
import { CreateGroupDialog } from '@/components/community/CreateGroupDialog';
import { JoinGroupDialog } from '@/components/community/JoinGroupDialog';
import { CommunityActivityFeed } from '@/components/community/CommunityActivityFeed';
import { FriendsEntryCard } from '@/components/community/FriendsEntryCard';
import { useGroups } from '@/hooks/useGroups';

export default function Community() {
  const navigate = useNavigate();
  const { myGroups, publicGroups, loading, createGroup, joinGroupByCode, joinPublicGroup, updateGroupOrder } = useGroups();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('my-community');
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  const handleJoinPublicGroup = async (groupId: string) => {
    setJoiningGroupId(groupId);
    await joinPublicGroup(groupId);
    setJoiningGroupId(null);
  };

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      {/* Page Header */}
      <PlayerPageHeader
        icon={Users}
        title="Community"
        subtitle="Groups, players, and local pickleball activity"
        background="gradient"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full hover:bg-muted/50"
              aria-label="Search"
              onClick={() => setActiveTab('explore')}
            >
              <Search className="h-5 w-5" />
            </Button>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              className="h-10 px-4 rounded-full btn-premium"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create
            </Button>
          </div>
        }
      />

      {/* Sliding-underline Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 sm:px-6 pt-4">
          <div className="relative border-b border-border/40">
            <div className="grid grid-cols-2">
              {[
                { value: 'my-community', label: 'My Community' },
                { value: 'explore', label: 'Explore' },
              ].map((tab) => {
                const isActive = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={cn(
                      'relative py-2.5 text-sm font-medium transition-colors duration-200',
                      isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
            {/* Sliding underline indicator */}
            <div
              className="absolute bottom-0 h-[2px] bg-primary rounded-full transition-all duration-[240ms] ease-out"
              style={{
                width: '50%',
                left: activeTab === 'my-community' ? '0%' : '50%',
              }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* My Community */}
          <TabsContent value="my-community" className="m-0 px-4 sm:px-6 pt-4 pb-8 space-y-6">
            {/* Action row */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setJoinDialogOpen(true)}
                className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/40 hover:bg-muted/30 transition-colors active:scale-[0.99] text-left"
              >
                <QrCode className="h-5 w-5 text-primary shrink-0" />
                <span className="text-sm font-medium">Join with Code</span>
              </button>
              <button
                onClick={() => setCreateDialogOpen(true)}
                className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/40 hover:bg-muted/30 transition-colors active:scale-[0.99] text-left"
              >
                <Users className="h-5 w-5 shrink-0" />
                <span className="text-sm font-medium">Create Group</span>
              </button>
            </div>

            {/* Friends entry */}
            <FriendsEntryCard />



            {/* Your Groups */}
            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight font-display">Your Groups</h2>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <Skeleton key={i} className="h-20 w-full rounded-xl" />
                  ))}
                </div>
              ) : myGroups.length > 0 ? (
                <ReorderableGroupList groups={myGroups} onReorder={updateGroupOrder} />
              ) : (
                <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed border-border/50">
                  <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                    <Users className="h-5 w-5 text-muted-foreground/60" />
                  </div>
                  <p className="text-sm text-muted-foreground max-w-[260px]">
                    Join with a code or create a group to get started
                  </p>
                </div>
              )}
            </section>

            {/* Recent Activity */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight font-display">Recent Activity</h2>
                <button
                  onClick={() => navigate('/player/notifications')}
                  className="flex items-center gap-1 text-sm font-medium text-primary"
                >
                  View all
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <CommunityActivityFeed />
            </section>
          </TabsContent>

          {/* Explore */}
          <TabsContent value="explore" className="m-0 px-4 sm:px-6 pt-4 pb-8 space-y-3">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : publicGroups.length > 0 ? (
              <>
                <p className="text-xs text-muted-foreground/70">
                  Public groups you can join
                </p>
                <div className="space-y-3">
                  {publicGroups.map((group) => {
                    const isAlreadyMember = myGroups.some((g) => g.id === group.id);
                    return (
                      <GroupCard
                        key={group.id}
                        group={{
                          ...group,
                          membership: isAlreadyMember ? myGroups.find((g) => g.id === group.id)?.membership : undefined,
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
        </div>
      </Tabs>

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
