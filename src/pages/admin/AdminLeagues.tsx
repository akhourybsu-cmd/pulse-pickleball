import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Search, ChevronRight, ListChecks } from "lucide-react";
import { logLeagueAction } from "@/lib/leagues/audit";
import type { League, LeagueType, LeagueStatus } from "@/lib/leagues/types";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<LeagueStatus, string> = {
  draft:    "bg-muted text-muted-foreground",
  active:   "bg-primary/15 text-primary",
  archived: "bg-slate-500/15 text-slate-500",
};

export default function AdminLeagues() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [leagues, setLeagues] = useState<League[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<LeagueStatus | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !(await isPlatformAdmin(user.id))) {
        toast.error("Admin privileges required");
        navigate("/player/dashboard");
        return;
      }
      await refresh();
    };
    init();
  }, [navigate]);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("leagues" as never)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Failed to load leagues");
    } else {
      setLeagues((data ?? []) as unknown as League[]);
    }
    setLoading(false);
  };

  const filtered = useMemo(() => {
    let list = leagues;
    if (statusFilter !== "all") list = list.filter((l) => l.status === statusFilter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.description?.toLowerCase().includes(q) ||
          l.location?.toLowerCase().includes(q),
      );
    }
    return list;
  }, [leagues, query, statusFilter]);

  return (
    <AdminLayout title="Leagues (admin-only)">
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
        {/* Safety banner — this feature is not shipped to players yet */}
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
          <strong className="font-semibold">Admin-only foundation.</strong>{" "}
          League Play is hidden from players. New leagues default to
          draft / admin-only visibility / not rating-eligible.
        </div>

        {/* Search + status + create */}
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search leagues…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as LeagueStatus | "all")}
          >
            <SelectTrigger className="w-[130px] shrink-0 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="shrink-0 h-10">
                <Plus className="w-4 h-4 mr-1" />
                New
              </Button>
            </DialogTrigger>
            <CreateLeagueDialog
              onCreated={async () => {
                setCreateOpen(false);
                await refresh();
              }}
            />
          </Dialog>
        </div>

        {/* List */}
        {loading ? (
          <div className="text-sm text-muted-foreground py-8 text-center">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <ListChecks className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium">
              {leagues.length === 0 ? "No leagues yet" : "No matches"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {leagues.length === 0
                ? "Create the first league to start scaffolding seasons and divisions."
                : "Try a different search or status."}
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((league) => (
              <li key={league.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/admin/leagues/${league.id}`)}
                  className="w-full text-left rounded-xl border border-border/70 bg-card p-3.5 hover:border-primary/40 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{league.name}</span>
                        <span
                          className={cn(
                            "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                            STATUS_TONE[league.status],
                          )}
                        >
                          {league.status}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {league.league_type}
                        </Badge>
                        {league.rating_eligible && (
                          <Badge variant="secondary" className="text-[10px]">
                            Rating-eligible
                          </Badge>
                        )}
                      </div>
                      {league.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {league.description}
                        </p>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-1 flex gap-3 flex-wrap">
                        {league.location && <span>{league.location}</span>}
                        <span>
                          Created {new Date(league.created_at).toLocaleDateString()}
                        </span>
                        <span className="italic">
                          Visibility: {league.visibility.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  );
}

/* -------- create dialog -------- */

function CreateLeagueDialog({ onCreated }: { onCreated: () => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [type, setType] = useState<LeagueType>("doubles");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Not authenticated");
      setSaving(false);
      return;
    }
    const { data, error } = await supabase
      .from("leagues" as never)
      .insert({
        name: name.trim(),
        description: description.trim() || null,
        location: location.trim() || null,
        created_by: user.id,
        league_type: type,
        // status / visibility / rating_eligible / guests_allowed all
        // take their column defaults: draft / admin_only / false / false
      } as never)
      .select()
      .single();
    if (error || !data) {
      toast.error(error?.message ?? "Failed to create league");
      setSaving(false);
      return;
    }
    const created = data as unknown as League;
    await logLeagueAction({
      leagueId: created.id,
      action: "league.created",
      entityType: "league",
      entityId: created.id,
      newValue: { name: created.name, league_type: created.league_type },
    });
    toast.success("League created (draft, admin-only)");
    setName(""); setDescription(""); setLocation(""); setType("doubles");
    setSaving(false);
    await onCreated();
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create league</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="league-name">Name *</Label>
          <Input
            id="league-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fall Doubles 2026"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="league-desc">Description</Label>
          <Textarea
            id="league-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this league for?"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="league-location">Location</Label>
          <Input
            id="league-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Venue or general location"
          />
        </div>
        <div className="space-y-1.5">
          <Label>League type</Label>
          <Select value={type} onValueChange={(v) => setType(v as LeagueType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="singles">Singles</SelectItem>
              <SelectItem value="doubles">Doubles</SelectItem>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="flex">Flex</SelectItem>
              <SelectItem value="ladder">Ladder</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Defaults to draft, admin-only visibility, not rating-eligible.
          You can flip those on the league page once it's created.
        </p>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? "Creating…" : "Create league"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
