import { useSearchParams } from "react-router-dom";
import { useCommunityDiscovery } from "@/hooks/useCommunityDiscovery";
import { useDebounce } from "@/hooks/useDebounce";
import { GuestAccountPrompt } from "@/components/community/GuestAccountPrompt";
import { CommunitySearchControls } from "@/components/community/CommunitySearchControls";
import { GroupCard } from "@/components/community/GroupCard";
import { Button } from "@/components/ui/button";
export default function PublicCommunities() {
  const [params, setParams] = useSearchParams();
  const search = params.get("q") || "";
  const debounced = useDebounce(search, 250);
  const page = Math.max(
    0,
    Math.min(416, Math.floor(Number(params.get("page"))) || 0),
  );
  const area = {
    city: params.get("city") || "",
    state: params.get("state") || "",
  };
  const query = useCommunityDiscovery(debounced, page, area);
  const change = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values))
      value ? next.set(key, value) : next.delete(key);
    setParams(next, { replace: true });
  };
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          Find your people
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
          Discover communities
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Find local venues, player crews, and your next game.
        </p>
      </div>
      <CommunitySearchControls
        search={search}
        onSearch={(value) => change({ q: value, page: null })}
        area={area}
        onArea={(value) =>
          change({
            city: value?.city || null,
            state: value?.state || null,
            page: null,
          })
        }
      />
      {query.isLoading || search !== debounced ? (
        <p role="status">Finding communities…</p>
      ) : query.isError ? (
        <div role="alert" className="space-y-3">
          <p>We couldn’t load communities. Please try again.</p>
          <Button variant="outline" onClick={() => void query.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <>
          {query.data?.items.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {query.data.items.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          ) : (
            <p>No communities found. Try another name, town, or state.</p>
          )}
          {(page > 0 || query.data?.has_more) && (
            <nav
              aria-label="Community result pages"
              className="flex items-center justify-between gap-3"
            >
              <Button
                variant="outline"
                disabled={!page || query.isFetching}
                onClick={() =>
                  change({ page: page === 1 ? null : String(page - 1) })
                }
              >
                Previous
              </Button>
              <span className="text-sm">Page {page + 1}</span>
              <Button
                variant="outline"
                disabled={!query.data?.has_more || query.isFetching}
                onClick={() => change({ page: String(page + 1) })}
              >
                Next
              </Button>
            </nav>
          )}
        </>
      )}
      <GuestAccountPrompt action="join communities, connect with players, and plan your next game" />
    </div>
  );
}
