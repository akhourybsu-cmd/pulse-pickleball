import { VenueAdminPageHeader } from "@/components/venue/VenueAdminPageHeader";
import { VenueAdminSubnav } from "@/components/venue/VenueAdminSubnav";
import { useVenueAdminLayout } from "@/components/venue/VenueAdminLayout";
import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Link2, Plus, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuthState } from "@/hooks/useAuthState";
import { eventManagementRpc as rpc } from "@/lib/venues/eventManagement";
import {
  type VenueCompetitions as Workspace,
  venueRoundRobinHref,
} from "@/lib/venues/competitions";
import { VenueRoundRobinCard } from "@/components/venue/VenueRoundRobinCard";

export default function VenueCompetitions() {
  const { groupId = "" } = useParams();
  const { user } = useAuthState();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const leaguesTab = params.get("tab") === "leagues";
  const [search, setSearch] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dialog, setDialog] = useState<"create" | "link" | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("ladder");
  const [leagueId, setLeagueId] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const base = `/player/community/group/${groupId}`;
  const query = useQuery({
    queryKey: ["venue-competitions", groupId, user?.id],
    enabled: !!groupId && !!user,
    queryFn: () =>
      rpc<Workspace>("get_venue_competitions", { p_group: groupId }),
    refetchInterval: busy || dialog ? false : 30000,
  });
  async function act(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await action();
      await query.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const w = query.data;
  if (query.isPending)
    return (
      <main className="mx-auto max-w-6xl p-6">
        <p role="status">Loading venue competitions…</p>
      </main>
    );
  if (!w || query.isError)
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-6">
        <Link to={`${base}/manage`}>Back to venue management</Link>
        <p role="alert">
          {query.error?.message || "Venue management access is required."}
        </p>
        <Button onClick={() => void query.refetch()}>Retry</Button>
      </main>
    );
  const events = w.round_robins.filter(
    (e) =>
      e.title.toLowerCase().includes(search.toLowerCase()) &&
      (showHistory || (!e.canceled_at && new Date(e.end_time) >= new Date())),
  );
  const leagues = w.leagues.filter((l) =>
    l.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 pb-28 sm:px-6">
      <VenueAdminPageHeader
        title="Round robins & leagues"
        description="Turn scheduled events into match play. Run your leagues, seasons, players and standings from your venue."
      />
      <VenueAdminSubnav
        label="Venue competition tools"
        value={leaguesTab ? "leagues" : "round-robins"}
        onChange={(value) => {
          setParams(value === "leagues" ? { tab: "leagues" } : {});
          setSearch("");
        }}
        items={[
          { value: "round-robins", label: "Round robins" },
          { value: "leagues", label: "Leagues" },
        ]}
      >
        <Button asChild variant="outline">
          <Link to={`${base}/events/manage`}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Events & registrations
          </Link>
        </Button>
      </VenueAdminSubnav>
      {error && !dialog && (
        <p
          role="alert"
          className="rounded-xl border border-destructive/30 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          className="min-w-48 flex-1"
          aria-label="Search competitions"
          placeholder={
            leaguesTab ? "Search leagues" : "Search scheduled round robins"
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {leaguesTab ? (
          <>
            <Button
              onClick={() => {
                setError("");
                setRequestId(crypto.randomUUID());
                setDialog("create");
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create league
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setError("");
                setDialog("link");
              }}
            >
              <Link2 className="mr-2 h-4 w-4" />
              Connect existing league
            </Button>
          </>
        ) : (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showHistory}
              onChange={(e) => setShowHistory(e.target.checked)}
            />
            Include past & canceled
          </label>
        )}
      </div>
      {leaguesTab ? (
        <section
          className="grid gap-4 md:grid-cols-2"
          aria-label="Venue leagues"
        >
          {leagues.map((l) => (
            <article key={l.id} className="rounded-2xl border bg-card p-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {l.league_type === "ladder"
                  ? "Individual doubles ladder"
                  : l.league_type}{" "}
                · {l.status}
              </p>
              <h2 className="mt-2 text-xl font-semibold">{l.name}</h2>
              <p className="my-4 text-sm text-muted-foreground">
                {l.seasons} seasons · {l.members} players
              </p>
              <Button asChild>
                <Link to={`${base}/competitions/leagues/${l.id}/manage`}>
                  <Trophy className="mr-2 h-4 w-4" />
                  Manage league
                </Link>
              </Button>
            </article>
          ))}
          {!leagues.length && (
            <div className="rounded-2xl border border-dashed p-6 md:col-span-2">
              <h2 className="font-semibold">
                {search ? "No matching leagues" : "Your venue’s league home"}
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Create a league or connect one you own. Manage seasons, rosters,
                sessions, matches and standings with the existing league tools.
              </p>
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-4" aria-label="Scheduled round robins">
          <p className="text-sm leading-6 text-muted-foreground">
            One click copies event details and confirmed players. Signups and
            paid places stay with the venue event. Close registration when
            you’re ready to generate matchups.
          </p>
          {events.map((e) => (
            <VenueRoundRobinCard
              key={e.id}
              event={e}
              groupId={groupId}
              timezone={w.venue.timezone}
              busy={busy}
              onSetup={() =>
                void act(async () => {
                  const id = await rpc<string>("setup_venue_round_robin", {
                    p_event: e.id,
                  });
                  navigate(venueRoundRobinHref(groupId, id));
                })
              }
            />
          ))}
          {!events.length && (
            <div className="space-y-3 rounded-2xl border border-dashed p-6">
              <h2 className="font-semibold">
                {search
                  ? "No matching round robins"
                  : "Schedule your next round robin"}
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose Round Robin in event management, assign courts and
                publish. It will appear here ready to set up.
              </p>
              <Button asChild variant="outline">
                <Link to={`${base}/events/manage?new=1`}>
                  Schedule an event
                </Link>
              </Button>
            </div>
          )}
        </section>
      )}
      <Dialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {dialog === "create"
                ? "Create a venue league"
                : "Connect an existing league"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "create"
                ? "Your existing league allowance applies. Creating a league does not charge players."
                : "Choose a league you own. Current venue managers will be able to operate it; its seasons, players and results are retained."}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                const id =
                  dialog === "create"
                    ? await rpc<string>("create_venue_league", {
                        p_group: groupId,
                        p_name: name.trim(),
                        p_description: description.trim() || null,
                        p_type: type,
                        p_request: requestId,
                      })
                    : await rpc<string>("link_venue_league", {
                        p_group: groupId,
                        p_league: leagueId,
                      });
                setDialog(null);
                setName("");
                setDescription("");
                navigate(`${base}/competitions/leagues/${id}/manage`);
              });
            }}
          >
            {dialog === "create" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="league-name">League name</Label>
                  <Input
                    id="league-name"
                    required
                    maxLength={150}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="league-type">Format</Label>
                  <select
                    id="league-type"
                    className="flex h-11 w-full rounded-lg border bg-background px-3"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="ladder">Individual doubles ladder</option>
                    <option value="doubles">
                      Basic league · manual schedule
                    </option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="league-description">Description</Label>
                  <Textarea
                    id="league-description"
                    maxLength={5000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="existing-league">League you own</Label>
                <select
                  id="existing-league"
                  required
                  className="flex h-11 w-full rounded-lg border bg-background px-3"
                  value={leagueId}
                  onChange={(e) => setLeagueId(e.target.value)}
                >
                  <option value="">Choose a league</option>
                  {w.available_leagues.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                {!w.available_leagues.length && (
                  <p className="text-sm text-muted-foreground">
                    You have no unconnected leagues available. Create a new
                    league to get started.
                  </p>
                )}
              </div>
            )}
            {error && (
              <div role="alert" className="space-y-2 text-sm text-destructive">
                <p>{error}</p>
                {/quota|slot/i.test(error) && (
                  <Link className="underline" to="/player/leagues">
                    Manage your league allowance
                  </Link>
                )}
              </div>
            )}
            <Button
              disabled={busy || (dialog === "link" && !leagueId)}
              type="submit"
            >
              {busy
                ? "Saving…"
                : dialog === "create"
                  ? "Create league"
                  : "Connect league"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
