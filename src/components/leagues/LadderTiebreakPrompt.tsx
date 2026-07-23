import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, Swords, ArrowUp, ArrowDown, Minus } from "lucide-react";

/**
 * Decides whether the player at `index` in the ordered list moves up, down,
 * or stays based on the court's tie boundaries. Top of the list gets the
 * promotion spot (if in play); bottom gets the relegation spot (if in play).
 */
function movementFor(
  index: number, total: number, boundaries: string[],
): "up" | "down" | "stay" {
  const promo = boundaries.includes("promotion");
  const relo = boundaries.includes("relegation");
  if (index === 0 && promo) return "up";
  if (index === total - 1 && relo) return "down";
  return "stay";
}

function MovementBadge({ kind }: { kind: "up" | "down" | "stay" }) {
  if (kind === "up") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
        <ArrowUp className="w-3 h-3" strokeWidth={3} /> Up
      </span>
    );
  }
  if (kind === "down") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/40 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
        <ArrowDown className="w-3 h-3" strokeWidth={3} /> Down
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground border border-border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide">
      <Minus className="w-3 h-3" strokeWidth={3} /> Stay
    </span>
  );
}

function MovementLegend({ boundaries }: { boundaries: string[] }) {
  const promo = boundaries.includes("promotion");
  const relo = boundaries.includes("relegation");
  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-muted/30 border-b border-border/50 text-[10px] text-muted-foreground">
      <span className="font-bold uppercase tracking-wide">Finishing order:</span>
      {promo && <><MovementBadge kind="up" /><span>top moves up a court</span></>}
      {promo && relo && <span>·</span>}
      {relo && <><MovementBadge kind="down" /><span>bottom moves down a court</span></>}
      {!promo && !relo && <span>determines final placement</span>}
    </div>
  );
}
import { resolvePlayerName } from "@/lib/matchDisplay";

/**
 * Player-side tiebreak resolver. When a court ties at a spot that decides who
 * moves up/down, auto-advance writes a pending row (RLS-scoped to that
 * court's players). This card lets any of them record the finishing order —
 * e.g. after a skinny-singles game — so the ladder advances without the
 * organizer. Renders nothing unless the current player has a pending tie.
 */

interface ProfileLite {
  display_name: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface PendingTie {
  id: string;
  season_id: string;
  group_id: string;
  court_number: number | null;
  tied_player_ids: string[];
  boundaries: string[];
}

export function LadderTiebreakPrompt({
  leagueId,
  playersById,
  onResolved,
}: {
  leagueId: string;
  playersById: Record<string, ProfileLite>;
  onResolved: () => void;
}) {
  const [ties, setTies] = useState<PendingTie[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("ladder_tiebreaks" as never)
      .select("id, season_id, group_id, court_number, tied_player_ids, boundaries")
      .eq("league_id", leagueId)
      .is("resolved_at", null);
    setTies((data ?? []) as unknown as PendingTie[]);
  }, [leagueId]);

  useEffect(() => { load(); }, [load]);

  if (ties.length === 0) return null;

  const nameOf = (id: string) =>
    playersById[id] ? resolvePlayerName(playersById[id] as never) : "Player";

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Swords className="w-4 h-4 text-amber-600" />
        <h2 className="text-sm font-bold">Tiebreaker needed</h2>
      </div>
      <p className="text-xs text-muted-foreground">
        Your court finished level. Play a quick tiebreaker (e.g. a skinny-singles
        game) and set the finishing order — top of the list advances. This lets
        the ladder move on without waiting for the organizer.
      </p>
      {ties.map((t) => (
        <TieCard key={t.id} tie={t} nameOf={nameOf} onDone={() => { load(); onResolved(); }} />
      ))}
    </div>
  );
}

function TieCard({
  tie, nameOf, onDone,
}: {
  tie: PendingTie;
  nameOf: (id: string) => string;
  onDone: () => void;
}) {
  const [order, setOrder] = useState<string[]>([...tie.tied_player_ids]);
  const [saving, setSaving] = useState(false);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  const submit = async () => {
    setSaving(true);
    const { error } = await (supabase.rpc as unknown as (
      fn: string, args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>)(
      "record_ladder_tiebreak",
      { p_group_id: tie.group_id, p_ordered_ids: order },
    );
    if (error) { setSaving(false); toast.error(error.message); return; }
    // Nudge auto-advance so the batch processes now that the tie is settled.
    try {
      await supabase.functions.invoke("ladder-advance", { body: { season_id: tie.season_id } });
    } catch { /* best-effort */ }
    setSaving(false);
    toast.success("Tiebreak recorded — the ladder can move on");
    onDone();
  };

  return (
    <div className="rounded-lg border border-border/70 bg-background/60">
      <div className="px-3 py-2 border-b border-border/50 text-xs font-bold">
        Court {tie.court_number ?? "—"}
      </div>
      <ol className="divide-y divide-border/40">
        {order.map((pid, i) => (
          <li key={pid} className="flex items-center gap-2 px-3 py-2">
            <span className="text-xs font-black tabular-nums w-5 text-center text-muted-foreground">
              {i + 1}
            </span>
            <span className="text-sm font-medium flex-1 truncate">{nameOf(pid)}</span>
            <div className="flex items-center">
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                disabled={i === 0 || saving} onClick={() => move(i, -1)} aria-label="Move up">
                <ChevronUp className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                disabled={i === order.length - 1 || saving} onClick={() => move(i, 1)} aria-label="Move down">
                <ChevronDown className="w-4 h-4" />
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="p-3">
        <Button onClick={submit} disabled={saving} className="w-full h-10 font-bold uppercase tracking-wide">
          {saving ? "Recording…" : "Record result"}
        </Button>
      </div>
    </div>
  );
}
