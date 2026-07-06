import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Search, ChevronRight, Trophy, MapPin,
  Sparkles, ShieldAlert, Shuffle, Layers, Zap,
} from "lucide-react";
import { logLeagueAction } from "@/lib/leagues/audit";
import type {
  League, LeagueType, LeagueStatus,
} from "@/lib/leagues/types";
import { cn } from "@/lib/utils";
import { FormShell, FormSection, FormRow, FIELD_H } from "@/components/admin/leagues/_shared";

const STATUS_TONE: Record<LeagueStatus, string> = {
  draft:    "bg-slate-500/10 text-slate-500 ring-1 ring-slate-500/20",
  active:   "bg-primary/15 text-primary ring-1 ring-primary/25",
  archived: "bg-muted text-muted-foreground ring-1 ring-border",
};

// Sporty color accent per league type. Muted enough to work with the
// existing PULSE dark-hero look; distinctive enough to make each
// league type immediately recognizable in a long list.
const TYPE_ACCENT: Record<LeagueType, { stripe: string; icon: typeof Trophy; label: string }> = {
  singles:  { stripe: "bg-blue-500",   icon: Zap,      label: "Singles"  },
  doubles:  { stripe: "bg-emerald-500", icon: Shuffle, label: "Doubles"  },
  team:     { stripe: "bg-primary",    icon: Trophy,  label: "Team"     },
  flex:     { stripe: "bg-amber-500",  icon: Sparkles,label: "Flex"     },
  ladder:   { stripe: "bg-violet-500", icon: Layers,  label: "Ladder"   },
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

  const activeCount = leagues.filter((l) => l.status === "active").length;

  return (
    <AdminLayout title="Leagues">
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-5">
        {/* Sporty hero */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0B171F] via-[#142029] to-[#1a2d38] p-5 sm:p-6 border border-slate-800">
          {/* Decorative diagonal stripes */}
          <div className="absolute inset-0 opacity-[0.04] pointer-events-none"
               style={{
                 backgroundImage: "repeating-linear-gradient(45deg, transparent 0, transparent 12px, currentColor 12px, currentColor 13px)",
                 color: "#A6DB5A",
               }}
               aria-hidden />
          <div className="relative flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#A6DB5A]/15 text-[#A6DB5A] text-[10px] font-bold uppercase tracking-wider ring-1 ring-[#A6DB5A]/30">
                <ShieldAlert className="w-3 h-3" />
                Admin-only foundation
              </div>
              <h1 className="mt-3 text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                League Play
              </h1>
              <p className="text-slate-400 text-sm mt-1.5 max-w-md">
                Build seasons, divisions, teams, and match schedules.
                Hidden from players until you're ready.
              </p>

              {/* Snapshot stats */}
              {!loading && leagues.length > 0 && (
                <div className="mt-4 flex items-center gap-4 text-slate-300">
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-[#A6DB5A] tabular-nums">{activeCount}</span>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                      Active
                    </span>
                  </span>
                  <span className="text-slate-700">·</span>
                  <span className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-bold text-white tabular-nums">{leagues.length}</span>
                    <span className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
                      Total
                    </span>
                  </span>
                </div>
              )}
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button
                  size="sm"
                  className="bg-[#A6DB5A] text-[#0B171F] hover:bg-[#A6DB5A]/90 font-semibold shrink-0"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  New league
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
        </div>

        {/* Search + status filter */}
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
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* League list */}
        {loading ? (
          <div className="space-y-2 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-muted/50" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Trophy className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold">
              {leagues.length === 0 ? "No leagues yet" : "No matches"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {leagues.length === 0
                ? "Create the first league to start scaffolding seasons, divisions, and match schedules."
                : "Try a different search or status filter."}
            </p>
            {leagues.length === 0 && (
              <Button
                size="sm"
                onClick={() => setCreateOpen(true)}
                className="mt-4"
              >
                <Plus className="w-4 h-4 mr-1" /> New league
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-2.5">
            {filtered.map((league) => {
              const accent = TYPE_ACCENT[league.league_type];
              const TypeIcon = accent.icon;
              return (
                <li key={league.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/player/leagues/${league.id}/manage`)}
                    className="group w-full text-left rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:shadow-md transition-all overflow-hidden"
                  >
                    <div className="flex items-stretch">
                      {/* Type-accent stripe (sporty side rail) */}
                      <div className={cn("w-1.5 shrink-0", accent.stripe)} aria-hidden />
                      <div className="flex-1 min-w-0 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            {/* Top row: name + status */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-base truncate">{league.name}</span>
                              <span
                                className={cn(
                                  "text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded",
                                  STATUS_TONE[league.status],
                                )}
                              >
                                {league.status}
                              </span>
                            </div>

                            {/* Type + rating chips */}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                <TypeIcon className="w-3 h-3" />
                                {accent.label}
                              </span>
                              {league.rating_eligible && (
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded ring-1 ring-primary/20">
                                  Rating-eligible
                                </span>
                              )}
                              {league.visibility !== "admin_only" && (
                                <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                                  {league.visibility.replace("_", " ")}
                                </span>
                              )}
                            </div>

                            {league.description && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {league.description}
                              </p>
                            )}

                            {/* Bottom meta */}
                            <div className="text-[11px] text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-0.5 items-center">
                              {league.location && (
                                <span className="inline-flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {league.location}
                                </span>
                              )}
                              <span>Created {new Date(league.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1 group-hover:translate-x-0.5 group-hover:text-primary transition-all" />
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
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
    <FormShell
      icon={<Trophy className="w-5 h-5" />}
      tone="gold"
      title="Create league"
      subtitle="Draft-only until you flip visibility. Seasons, divisions, and members all live inside."
      primaryLabel="Create league"
      primaryLoading={saving}
      primaryDisabled={!name.trim()}
      onPrimary={submit}
    >
      <FormSection label="Basics">
        <FormRow label="Name" htmlFor="league-name" required>
          <Input
            id="league-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Fall Doubles 2026"
            className={FIELD_H}
          />
        </FormRow>
        <FormRow label="Description" htmlFor="league-desc">
          <Textarea
            id="league-desc"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What is this league for?"
          />
        </FormRow>
        <FormRow label="Location" htmlFor="league-location">
          <Input
            id="league-location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Venue or general location"
            className={FIELD_H}
          />
        </FormRow>
      </FormSection>

      <FormSection label="Format">
        <FormRow
          label="League type"
          hint="Defaults to admin-only visibility and not rating-eligible. Both editable after creation."
        >
          <Select value={type} onValueChange={(v) => setType(v as LeagueType)}>
            <SelectTrigger className={FIELD_H}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="singles">Singles</SelectItem>
              <SelectItem value="doubles">Doubles</SelectItem>
              <SelectItem value="team">Team</SelectItem>
              <SelectItem value="flex">Flex</SelectItem>
              <SelectItem value="ladder">Ladder</SelectItem>
            </SelectContent>
          </Select>
        </FormRow>
      </FormSection>
    </FormShell>
  );
}
