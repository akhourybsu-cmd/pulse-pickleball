import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { isVenueCommunitiesEnabled } from "@/lib/venues/featureFlag";
import { Plus, QrCode, Users, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { GroupCard } from "@/components/community/GroupCard";
import { ReorderableGroupList } from "@/components/community/ReorderableGroupList";
import { CreateGroupDialog } from "@/components/community/CreateGroupDialog";
import { JoinGroupDialog } from "@/components/community/JoinGroupDialog";
import { VenueCommunityPrompt } from "@/components/community/VenueCommunityPrompt";
import { CommunitySearchControls } from "@/components/community/CommunitySearchControls";
import { SocialHero, SocialEmptyState } from "@/components/social/_shared";
import { PlayerSegmentedControl } from "@/components/layout/PlayerSegmentedControl";
import { useGroups } from "@/hooks/useGroups";
import { useAuthState } from "@/hooks/useAuthState";
import { useCommunityDiscovery } from "@/hooks/useCommunityDiscovery";
import { useDebounce } from "@/hooks/useDebounce";
import {
  matchesCommunity,
  nearbyCommunities,
  type CommunityArea,
} from "@/lib/community/discovery";
export default function Community() {
  const {
    myGroups,
    loading,
    error,
    refetch,
    createGroup,
    joinGroupByCode,
    joinPublicGroup,
  } = useGroups({ includePublic: false });
  const { user, profile } = useAuthState();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "explore" ? "explore" : "mine";
  const search = params.get("q") || "";
  const debounced = useDebounce(search, 250);
  const page = Math.max(
    0,
    Math.min(416, Math.floor(Number(params.get("page"))) || 0),
  );
  const savedArea = { city: profile?.town || "", state: profile?.state || "" };
  const area = params.has("area")
    ? { city: params.get("city") || "", state: params.get("state") || "" }
    : savedArea;
  const discovery = useCommunityDiscovery(
    debounced,
    page,
    area,
    view === "explore",
  );
  const [createOpen, setCreateOpen] = useState(false),
    [joinOpen, setJoinOpen] = useState(false),
    [joining, setJoining] = useState<string | null>(null);
  const change = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values))
      value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };
  const changeArea = (value: CommunityArea | null) =>
    change({
      area: value ? "custom" : null,
      city: value?.city || null,
      state: value?.state || null,
      page: null,
    });
  const mine = nearbyCommunities(
    myGroups.filter((group) => matchesCommunity(group, search)),
    area,
  );
  const busy = search !== debounced || discovery.isFetching;
  const join = async (id: string) => {
    setJoining(id);
    try {
      await joinPublicGroup(id);
    } finally {
      setJoining(null);
    }
  };
  return (
    <div className="flex min-h-[calc(100vh-120px)] flex-col">
      <SocialHero eyebrow="Find your people" title="Communities">
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <PlayerSegmentedControl
            value={view}
            onValueChange={(value) =>
              change({ view: value === "mine" ? null : value, page: null })
            }
            options={[
              {
                value: "mine",
                label: "Joined",
                icon: Users,
                count: myGroups.length,
              },
              { value: "explore", label: "Discover", icon: Compass },
            ]}
            ariaLabel="Community views"
            layoutId="community-seg-active"
            className="min-w-[190px] flex-1 lg:max-w-sm lg:flex-none"
          />
          <div className="flex w-full gap-2 sm:ml-auto sm:w-auto">
            <Button
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => setJoinOpen(true)}
            >
              <QrCode className="mr-1.5 h-4 w-4" />
              Join with code
            </Button>
            <Button
              className="h-11 flex-1 rounded-xl sm:flex-none"
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Create
            </Button>
          </div>
        </div>
      </SocialHero>
      <div className="container mx-auto min-h-0 max-w-[1400px] flex-1 px-4 pb-10 pt-5 sm:px-6 lg:px-8">
        <CommunitySearchControls
          search={search}
          onSearch={(value) => change({ q: value, page: null })}
          area={area}
          onArea={changeArea}
          savedArea={savedArea}
        />
        {view === "mine" ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">Your communities</h2>
              {search && (
                <Button
                  variant="link"
                  onClick={() => change({ view: "explore", page: null })}
                >
                  Search all communities →
                </Button>
              )}
            </div>
            {loading ? (
              <CommunitySkeleton />
            ) : error ? (
              <LoadError onRetry={() => void refetch()} />
            ) : mine.length ? (
              <ReorderableGroupList groups={mine} />
            ) : (
              <SocialEmptyState
                icon={Users}
                title={
                  search ? "No joined communities match" : "Find your community"
                }
                description={
                  search
                    ? "Try another name or search all public communities."
                    : "Discover local venues and player groups, or join with an invite code."
                }
                action={
                  <Button
                    onClick={() => change({ view: "explore", page: null })}
                  >
                    Explore communities
                  </Button>
                }
              />
            )}
          </>
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold">
                {search ? "Search results" : "Discover communities"}
              </h2>
              <p className="text-xs text-muted-foreground" role="status">
                {busy
                  ? "Finding communities…"
                  : area.state
                    ? "Your town and state first"
                    : "All areas"}
              </p>
            </div>
            {discovery.isLoading || search !== debounced ? (
              <CommunitySkeleton />
            ) : discovery.isError ? (
              <LoadError onRetry={() => void discovery.refetch()} />
            ) : discovery.data?.items.length ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {discovery.data.items.map((group) => {
                  const member = myGroups.find((item) => item.id === group.id);
                  return (
                    <GroupCard
                      key={group.id}
                      group={{
                        ...group,
                        membership: member?.membership,
                        unread_count: member?.unread_count ?? 0,
                      }}
                      showJoinButton={!member}
                      onJoin={join}
                      isJoining={joining === group.id}
                    />
                  );
                })}
              </div>
            ) : (
              <SocialEmptyState
                icon={Compass}
                title="No communities found"
                description="Try another name, town, or state."
                action={
                  search ? (
                    <Button
                      variant="outline"
                      onClick={() => change({ q: null, page: null })}
                    >
                      Clear search
                    </Button>
                  ) : undefined
                }
              />
            )}
            {!discovery.isError && (page > 0 || discovery.data?.has_more) && (
              <nav
                aria-label="Community result pages"
                className="mt-5 flex items-center justify-between gap-3"
              >
                <Button
                  variant="outline"
                  disabled={page === 0 || busy}
                  onClick={() =>
                    change({ page: page === 1 ? null : String(page - 1) })
                  }
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page + 1}
                </span>
                <Button
                  variant="outline"
                  disabled={!discovery.data?.has_more || busy}
                  onClick={() => change({ page: String(page + 1) })}
                >
                  Next
                </Button>
              </nav>
            )}
          </>
        )}
        {isVenueCommunitiesEnabled() && user && (
          <VenueCommunityPrompt key={user.id} userId={user.id} />
        )}
      </div>
      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={createGroup}
        onRequestVenue={() => navigate("/player/venue-requests?new=1")}
      />
      <JoinGroupDialog
        open={joinOpen}
        onOpenChange={setJoinOpen}
        onJoin={joinGroupByCode}
      />
    </div>
  );
}
function CommunitySkeleton() {
  return (
    <div
      className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      aria-label="Loading communities"
    >
      {[1, 2, 3, 4, 5, 6].map((n) => (
        <Skeleton key={n} className="h-40 rounded-2xl" />
      ))}
    </div>
  );
}
function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-2xl border p-6">
      <p>Communities couldn’t load. Please try again.</p>
      <Button variant="outline" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
