import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, ArrowUp, Layers } from "lucide-react";
import type { League, LeagueSeason, LeagueDivision } from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";
import { EmptyState, TabSkeleton, LeagueTabProps } from "./_shared";

export function DivisionsTab({ league, dataVersion, onMutated }: LeagueTabProps) {
  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [seasonId, setSeasonId] = useState<string | "">("");
  const [divisions, setDivisions] = useState<LeagueDivision[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LeagueDivision | null>(null);

  // Season list refetch — subscribes to dataVersion so newly-created
  // seasons from SeasonsTab appear immediately.
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("league_seasons" as never).select("*")
        .eq("league_id", league.id).order("created_at", { ascending: false });
      const list = (data ?? []) as unknown as LeagueSeason[];
      setSeasons(list);
      if (list.length && !seasonId) setSeasonId(list[0].id);
      setLoading(false);
    })();
    // eslint-disable-next-line
  }, [league.id, dataVersion]);

  useEffect(() => {
    if (!seasonId) { setDivisions([]); return; }
    (async () => {
      const { data, error } = await supabase
        .from("league_divisions" as never).select("*")
        .eq("season_id", seasonId).order("skill_min", { ascending: true });
      if (error) toast.error(error.message);
      setDivisions((data ?? []) as unknown as LeagueDivision[]);
    })();
  }, [seasonId, dataVersion]);

  if (loading) return <TabSkeleton lines={2} />;

  if (seasons.length === 0) {
    return (
      <EmptyState
        icon={<ArrowUp className="w-5 h-5" />}
        title="Create a season first"
        desc="Divisions live inside a season. Head to the Seasons tab to add one."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={seasonId} onValueChange={setSeasonId}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Pick a season" /></SelectTrigger>
          <SelectContent>
            {seasons.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" disabled={!seasonId}>
              <Plus className="w-4 h-4 mr-1" />New division
            </Button>
          </DialogTrigger>
          {seasonId && (
            <DivisionEditor
              league={league}
              seasonId={seasonId}
              initial={null}
              onDone={async () => {
                setCreateOpen(false);
                const { data } = await supabase
                  .from("league_divisions" as never).select("*")
                  .eq("season_id", seasonId).order("skill_min", { ascending: true });
                setDivisions((data ?? []) as unknown as LeagueDivision[]);
                onMutated();
              }}
            />
          )}
        </Dialog>
      </div>

      {divisions.length === 0 ? (
        <EmptyState
          icon={<Layers className="w-5 h-5" />}
          title="No divisions in this season"
          desc="Divisions let you split players by skill range."
          action={{ label: "New division", onClick: () => setCreateOpen(true) }}
        />
      ) : (
        <ul className="space-y-2">
          {divisions.map((d) => (
            <li key={d.id} className="rounded-lg border border-border/70 bg-card p-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{d.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Skill {d.skill_min?.toFixed(1) ?? "—"} – {d.skill_max?.toFixed(1) ?? "—"}
                  {d.status === "archived" && " · archived"}
                </div>
                {d.description && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.description}</div>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(d)}>Edit</Button>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && seasonId && (
          <DivisionEditor
            league={league}
            seasonId={seasonId}
            initial={editing}
            onDone={async () => {
              setEditing(null);
              const { data } = await supabase
                .from("league_divisions" as never).select("*")
                .eq("season_id", seasonId).order("skill_min", { ascending: true });
              setDivisions((data ?? []) as unknown as LeagueDivision[]);
              onMutated();
            }}
          />
        )}
      </Dialog>
    </div>
  );
}

function DivisionEditor({
  league, seasonId, initial, onDone,
}: {
  league: League;
  seasonId: string;
  initial: LeagueDivision | null;
  onDone: () => void | Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [skillMin, setSkillMin] = useState<string>(initial?.skill_min?.toString() ?? "");
  const [skillMax, setSkillMax] = useState<string>(initial?.skill_max?.toString() ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [status, setStatus] = useState<LeagueDivision["status"]>(initial?.status ?? "active");
  const [saving, setSaving] = useState(false);
  const isNew = !initial;

  const submit = async () => {
    if (!name.trim()) { toast.error("Name is required"); return; }
    const min = skillMin ? Number(skillMin) : null;
    const max = skillMax ? Number(skillMax) : null;
    if ((min !== null && Number.isNaN(min)) || (max !== null && Number.isNaN(max))) {
      toast.error("Skill values must be numbers"); return;
    }
    setSaving(true);
    const payload = {
      league_id: league.id,
      season_id: seasonId,
      name: name.trim(),
      skill_min: min,
      skill_max: max,
      description: description.trim() || null,
      status,
    };
    const q = isNew
      ? supabase.from("league_divisions" as never).insert(payload as never).select().single()
      : supabase.from("league_divisions" as never).update(payload as never).eq("id", initial!.id).select().single();
    const { data, error } = await q;
    if (error || !data) { toast.error(error?.message ?? "Save failed"); setSaving(false); return; }
    const saved = data as unknown as LeagueDivision;
    await logLeagueAction({
      leagueId: league.id, seasonId,
      action: isNew ? "division.created" : "division.updated",
      entityType: "division", entityId: saved.id,
      oldValue: initial ? { name: initial.name, status: initial.status } : null,
      newValue: payload,
    });
    toast.success(isNew ? "Division created" : "Division updated");
    setSaving(false);
    await onDone();
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{isNew ? "New division" : "Edit division"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label>Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="3.5+ Doubles" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Skill min</Label>
            <Input type="number" step="0.1" min="2" max="6"
              value={skillMin} onChange={(e) => setSkillMin(e.target.value)} placeholder="3.0" />
          </div>
          <div className="space-y-1.5">
            <Label>Skill max</Label>
            <Input type="number" step="0.1" min="2" max="6"
              value={skillMax} onChange={(e) => setSkillMax(e.target.value)} placeholder="4.0" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as LeagueDivision["status"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={saving} className="w-full">
          {saving ? "Saving…" : isNew ? "Create division" : "Save changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
