import { useState } from 'react';
import { Plus, QrCode, Users, Search, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GroupCard } from '@/components/community/GroupCard';
import { ReorderableGroupList } from '@/components/community/ReorderableGroupList';
import { CreateGroupDialog } from '@/components/community/CreateGroupDialog';
import { JoinGroupDialog } from '@/components/community/JoinGroupDialog';
import { SocialHero, SocialEmptyState } from '@/components/social/_shared';
import { PlayerSegmentedControl } from '@/components/layout/PlayerSegmentedControl';
import { useGroups } from '@/hooks/useGroups';

type View = 'mine' | 'explore';

/**
 * Community hub. The old layout crammed a 2-column tab strip and three action
 * buttons onto one row, which collided on narrow screens. It now uses the
 * shared premium hero with a glassy segmented switch (matching the Social hub)
 * and a separate action row, so the two views are clearly differentiated and
 * everything fits on mobile.
 */
export default function Community() {
  const { myGroups, publicGroups, loading, createGroup, createVenueCommunity, joinGroupByCode, joinPublicGroup, updateGroupOrder } = useGroups();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [view, setView] = useState<View>('mine');
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  const handleJoinPublicGroup = async (groupId: string) => {
    setJoiningGroupId(groupId);
    await joinPublicGroup(groupId);
    setJoiningGroupId(null);
  };

  const joinableCount = publicGroups.filter((g) => !myGroups.some((m) => m.id === g.id)).length;

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      <SocialHero eyebrow="Groups" title="Community">
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PlayerSegmentedControl
            value={view}
            onValueChange={setView}
            options={[
              { value: 'mine', label: 'Mine', icon: Users, count: myGroups.length },
              { value: 'explore', label: 'Explore', icon: Compass, count: joinableCount, accentCount: true },
            ]}
            ariaLabel="Community views"
            layoutId="community-seg-active"
            className="min-w-[190px] flex-1 lg:max-w-sm lg:flex-none"
          />

          <div className="flex w-full items-center gap-2 sm:ml-auto sm:w-auto sm:gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-11 w-11 rounded-xl border border-border/60 bg-card/80 shadow-sm transition-transform hover:bg-card active:scale-95 focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Join with code"
              onClick={() => setJoinDialogOpen(true)}
            >
              <QrCode className="h-[18px] w-[18px]" />
            </Button>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              size="sm"
              className="h-11 flex-1 rounded-xl px-4 text-[11px] font-bold uppercase tracking-[0.12em] btn-premium active:scale-[0.98] sm:flex-none"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create
            </Button>
          </div>
        </div>
      </SocialHero>

      <div className="container mx-auto min-h-0 max-w-[1400px] flex-1 px-4 pb-10 pt-4 sm:px-6 lg:px-8 lg:pt-6">
        {loading ? (
          <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : view === 'mine' ? (
          myGroups.length > 0 ? (
            <ReorderableGroupList groups={myGroups} onReorder={updateGroupOrder} />
          ) : (
            <SocialEmptyState
              icon={Users}
              title="No communities yet"
              description="Join a group with an invite code, or start your own crew, league, or club."
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button variant="outline" size="sm" className="h-10 rounded-full" onClick={() => setJoinDialogOpen(true)}>
                    <QrCode className="h-4 w-4 mr-1.5" /> Join with code
                  </Button>
                  <Button size="sm" className="h-10 rounded-full btn-premium" onClick={() => setView('explore')}>
                    <Compass className="h-4 w-4 mr-1.5" /> Explore groups
                  </Button>
                </div>
              }
            />
          )
        ) : publicGroups.length > 0 ? (
          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Public groups you can join
            </p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
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
          </div>
        ) : (
          <SocialEmptyState
            icon={Search}
            title="No public groups"
            description="Check back later, or create your own community and invite your players."
            action={
              <Button size="sm" className="h-10 rounded-full btn-premium" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1.5" /> Create a community
              </Button>
            }
          />
        )}
      </div>

      <CreateGroupDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSubmit={createGroup}
        onSubmitVenue={createVenueCommunity}
      />
      <JoinGroupDialog
        open={joinDialogOpen}
        onOpenChange={setJoinDialogOpen}
        onJoin={joinGroupByCode}
      />
    </div>
  );
}
