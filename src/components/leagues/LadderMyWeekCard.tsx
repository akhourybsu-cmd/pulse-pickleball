import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolvePlayerName } from "@/lib/matchDisplay";
import { LgSectionHeader } from "@/components/leagues/_leagueScope";
import { Layers, ArrowUp, ArrowDown, Minus } from "lucide-react";

interface Snapshot { player_ids: string[] }
interface BatchRow {
  id: string;
  week_number: number;
  batch_number: number;
  status: string;
}
interface GroupRow {
  id: string;
  court_number: number | null;
  wave: number;
  player_ids: string[];
}
interface MovementRow {
  player_id: string;
  direction: "up" | "stay" | "down";
  start_position: number;
  finish_position: number;
}

/**
 * "This week" orientation card for a ladder player.
 *
 * A ladder player's two most-asked questions are "where am I on the ladder?"
 * and "which court am I on and who with?". Both were previously only
 * inferable by scanning individual match rows or hunting the standings table,
 * so this pins them at the top of the player league page.
 */
export function LadderMyWeekCard({
  seasonId, currentUserId,
}: {
  seasonId: string | null;
  currentUserId: string | null;
}) {
  const [position, setPosition] = useState<number | null>(null);
  const [ladderSize, setLadderSize] = useState(0);
  const [batch, setBatch] = useState<BatchRow | null>(null);
  const [group, setGroup] = useState<GroupRow | null>(null);
  const [names, setNames] = useState<Record<string, string>>({});
  const [movement, setMovement] = useState<MovementRow | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!seasonId || !currentUserId) { setLoading(false); return; }
    setLoading(true);

    const [snapRes, batchRes] = await Promise.all([
      supabase.from("ladder_snapshots" as never).select("player_ids")
        .eq("season_id", seasonId)
        .order("week_number", { ascending: false })
        .order("batch_number", { ascending: false })
        .limit(1),
      supabase.from("ladder_batches" as never)
        .select("id, week_number, batch_number, status")
        .eq("season_id", seasonId)
        .order("week_number", { ascending: false })
        .order("batch_number", { ascending: false }),
    ]);

    const order = ((snapRes.data ?? []) as unknown as Snapshot[])[0]?.player_ids ?? [];
    const idx = order.indexOf(currentUserId);
    setLadderSize(order.length);
    setPosition(idx >= 0 ? idx + 1 : null);

    const batches = (batchRes.data ?? []) as unknown as BatchRow[];
    const live = batches.find(
      (b) => b.status !== "finalized" && b.status !== "invalidated",
    ) ?? null;
    setBatch(live);

    let myGroup: GroupRow | null = null;
    if (live) {
      const { data: grpRows } = await supabase.from("ladder_batch_groups" as never)
        .select("id, court_number, wave, player_ids")
        .eq("batch_id", live.id);
      myGroup = ((grpRows ?? []) as unknown as GroupRow[])
        .find((g) => g.player_ids?.includes(currentUserId)) ?? null;
    }
    setGroup(myGroup);

    // Last finalized batch's movement for me — the up/stay/down that put the
    // player where they are now.
    const lastFinal = batches.find((b) => b.status === "finalized") ?? null;
    if (lastFinal) {
      const { data: mv } = await supabase.from("ladder_movements" as never)
        .select("player_id, direction, start_position, finish_position")
        .eq("batch_id", lastFinal.id).eq("player_id", currentUserId).maybeSingle();
      setMovement((mv ?? null) as unknown as MovementRow | null);
    } else {
      setMovement(null);
    }

    const ids = Array.from(new Set(myGroup?.player_ids ?? []));
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles_public" as never)
        .select("id, display_name, full_name, first_name, last_name")
        .in("id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p) => {
        const r = p as { id: string };
        map[r.id] = resolvePlayerName(p as never);
      });
      setNames(map);
    }
    setLoading(false);
  }, [seasonId, currentUserId]);

  useEffect(() => { void load(); }, [load]);

  if (loading || (!position && !group)) return null;

  const MoveIcon = movement?.direction === "up"
    ? ArrowUp
    : movement?.direction === "down" ? ArrowDown : Minus;
  const moveTone = movement?.direction === "up"
    ? "text-[color:var(--lg-emerald-bright)]"
    : movement?.direction === "down"
      ? "text-destructive"
      : "text-[color:var(--lg-text-dim)]";

  return (
    <div className="lg-card p-4 space-y-3">
      <LgSectionHeader icon={Layers} className="mb-0">
        {batch ? `This week · Week ${batch.week_number}` : "Your ladder spot"}
      </LgSectionHeader>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-[color:var(--lg-border)] bg-[color:var(--lg-surface-2)] px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--lg-text-dim)]">
            Ladder position
          </div>
          <div className="text-2xl font-black tabular-nums text-[color:var(--lg-text)] flex items-baseline gap-1.5">
            {position ?? "—"}
            {ladderSize > 0 && position && (
              <span className="text-xs font-semibold text-[color:var(--lg-text-dim)]">
                of {ladderSize}
              </span>
            )}
          </div>
          {movement && (
            <div className={`mt-0.5 flex items-center gap-1 text-[11px] font-semibold ${moveTone}`}>
              <MoveIcon className="w-3 h-3" />
              {movement.direction === "stay"
                ? "Held your spot last round"
                : `${movement.direction === "up" ? "Up" : "Down"} from ${movement.start_position}`}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[color:var(--lg-border)] bg-[color:var(--lg-surface-2)] px-3 py-2">
          <div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--lg-text-dim)]">
            Your court
          </div>
          <div className="text-2xl font-black tabular-nums text-[color:var(--lg-text)]">
            {group?.court_number ?? "—"}
          </div>
          {group && group.wave > 1 && (
            <div className="mt-0.5 text-[11px] text-[color:var(--lg-text-dim)]">
              Wave {group.wave}
            </div>
          )}
        </div>
      </div>

      {group ? (
        <div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--lg-text-dim)] mb-1.5">
            Your foursome — you rotate partners across three games
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {group.player_ids.map((pid) => (
              <li
                key={pid}
                className={
                  pid === currentUserId
                    ? "rounded-full px-2.5 py-1 text-xs font-bold bg-[color:var(--lg-gold)]/15 text-[color:var(--lg-accent-gold)] ring-1 ring-[color:var(--lg-gold)]/40"
                    : "rounded-full px-2.5 py-1 text-xs font-medium bg-[color:var(--lg-surface-2)] text-[color:var(--lg-text)] border border-[color:var(--lg-border)]"
                }
              >
                {pid === currentUserId ? "You" : (names[pid] ?? "Player")}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-[color:var(--lg-text-dim)]">
          The next round hasn't been drawn yet — your court and foursome appear
          here as soon as the organizer generates it.
        </p>
      )}
    </div>
  );
}
