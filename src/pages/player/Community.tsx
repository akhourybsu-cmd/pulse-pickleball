import { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Plus, QrCode, Users, Search, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { GroupCard } from '@/components/community/GroupCard';
import { ReorderableGroupList } from '@/components/community/ReorderableGroupList';
import { CreateGroupDialog } from '@/components/community/CreateGroupDialog';
import { JoinGroupDialog } from '@/components/community/JoinGroupDialog';
import { SocialHero, SocialEmptyState } from '@/components/social/_shared';
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
  const reduced = useReducedMotion();

  const handleJoinPublicGroup = async (groupId: string) => {
    setJoiningGroupId(groupId);
    await joinPublicGroup(groupId);
    setJoiningGroupId(null);
  };

  const joinableCount = publicGroups.filter((g) => !myGroups.some((m) => m.id === g.id)).length;

  return (
    <div className="flex flex-col min-h-[calc(100vh-120px)]">
      <SocialHero eyebrow="Community" title={view === 'mine' ? 'My Communities' : 'Explore'}>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-xl border border-border/60 bg-card/70 p-1 backdrop-blur-sm shadow-[0_2px_14px_-10px_hsl(var(--foreground)/0.35)]"
            role="tablist"
            aria-label="Community views"
          >
            <SegButton
              active={view === 'mine'}
              onClick={() => setView('mine')}
              icon={Users}
              reduced={reduced}
              count={myGroups.length}
            >
              Mine
            </SegButton>
            <SegButton
              active={view === 'explore'}
              onClick={() => setView('explore')}
              icon={Compass}
              reduced={reduced}
              count={joinableCount}
            >
              Explore
            </SegButton>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full border border-border/60 bg-card/70 backdrop-blur-sm shadow-sm hover:bg-card"
              aria-label="Join with code"
              onClick={() => setJoinDialogOpen(true)}
            >
              <QrCode className="h-[18px] w-[18px]" />
            </Button>
            <Button
              onClick={() => setCreateDialogOpen(true)}
              size="sm"
              className="h-10 rounded-full px-4 text-[11px] font-bold uppercase tracking-[0.12em] btn-premium"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Create
            </Button>
          </div>
        </div>
      </SocialHero>

      <div className="flex-1 min-h-0 container mx-auto max-w-3xl px-4 sm:px-6 pt-4 pb-8">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
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

function SegButton({
  active, onClick, icon: Icon, reduced, count, children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  reduced: boolean | null;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'relative inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {active && (
        <motion.span
          layoutId="community-seg-active"
          aria-hidden
          className="absolute inset-0 rounded-lg bg-background shadow-sm ring-1 ring-border/60"
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <Icon className="relative h-4 w-4" />
      <span className="relative">{children}</span>
      {typeof count === 'number' && count > 0 && (
        <span
          className={cn(
            'relative rounded-full px-1.5 py-[1px] text-[10px] font-bold tabular-nums',
            active ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
