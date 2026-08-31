import { useState } from 'react';
import { Plus, QrCode, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { GroupCard } from '@/components/community/GroupCard';
import { ReorderableGroupList } from '@/components/community/ReorderableGroupList';
import { CreateGroupDialog } from '@/components/community/CreateGroupDialog';
import { JoinGroupDialog } from '@/components/community/JoinGroupDialog';
import { useGroups } from '@/hooks/useGroups';

export default function Community() {
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
      {/* Sliding-underline Tabs — index-driven so adding a tab is one
          array entry rather than a new manual left:% branch. Matches
          the MatchHistory / RoundRobinDetail pattern. */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4 sm:px-6 pt-4">
          {(() => {
            const tabs = [
              { value: 'my-community', label: 'My Community' },
              { value: 'explore', label: 'Explore' },
            ];
            const activeIndex = tabs.findIndex((t) => t.value === activeTab);
            return (
              <div className="flex items-end justify-between gap-3">
              <div className="relative border-b border-border/40 flex-1">
                <div className="grid grid-cols-2">
                  {tabs.map((tab) => {
                    const isActive = activeTab === tab.value;
                    return (
                      <button
                        key={tab.value}
                        onClick={() => setActiveTab(tab.value)}
                        className={cn(
                          'relative py-2.5 text-[13px] font-bold uppercase tracking-[0.1em] transition-colors duration-200',
                          isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
                        )}
                      >
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div
                  className="absolute bottom-0 h-[2px] bg-primary rounded-full transition-all duration-[240ms] ease-out"
                  style={{
                    width: `${100 / tabs.length}%`,
                    left: `${(100 / tabs.length) * Math.max(0, activeIndex)}%`,
                  }}
                />
                </div>
                <div className="flex items-center gap-1.5 mb-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full border border-border/70 bg-card shadow-sm hover:bg-muted/60"
                    aria-label="Join with code"
                    onClick={() => setJoinDialogOpen(true)}
                  >
                    <QrCode className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full border border-border/70 bg-card shadow-sm hover:bg-muted/60"
                    aria-label="Explore groups"
                    onClick={() => setActiveTab('explore')}
                  >
                    <Search className="h-5 w-5" />
                  </Button>
                  <Button
                    onClick={() => setCreateDialogOpen(true)}
                    size="sm"
                    className="h-10 rounded-full px-5 text-xs font-bold uppercase tracking-[0.1em] btn-premium"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    Create
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* My Community — a single, focused list of your community
              cards. Friends + recent-activity were removed so the groups
              themselves are the only thing here. */}
          <TabsContent value="my-community" className="m-0 px-4 sm:px-6 pt-4 pb-8">
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : myGroups.length > 0 ? (
              <ReorderableGroupList groups={myGroups} onReorder={updateGroupOrder} />
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center rounded-xl border border-dashed border-border/50">
                <div className="w-12 h-12 rounded-full bg-muted/40 flex items-center justify-center mb-3">
                  <Users className="h-5 w-5 text-muted-foreground/60" />
                </div>
                <p className="text-sm text-muted-foreground max-w-[260px] mb-4">
                  Join a group with a code, or create your own to get started.
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="rounded-full" onClick={() => setJoinDialogOpen(true)}>
                    <QrCode className="h-4 w-4 mr-1.5" /> Join with code
                  </Button>
                  <Button size="sm" className="rounded-full btn-premium" onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-1.5" /> Create
                  </Button>
                </div>
              </div>
            )}
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
