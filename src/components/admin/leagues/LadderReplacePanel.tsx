import { useState } from "react";
import { UserMinus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ActionButton } from "@/components/leagues/ActionButton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Replace a mid-season dropout with a new player, preserving their rung and the
 * multiple-of-four count (ladder_replace_player RPC). Only meaningful between
 * rounds — the caller renders this when no batch is in play. Eligible
 * replacements are active members not already on the ladder (add them on the
 * Players tab first). The swap takes effect from the next generated round.
 */
export function LadderReplacePanel({
  seasonId, currentOrder, memberIds, nameOf, disabled, onChanged,
}: {
  seasonId: string;
  currentOrder: string[];
  memberIds: string[];
  nameOf: (id: string) => string;
  disabled?: boolean;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [outId, setOutId] = useState<string>("");
  const [inId, setInId] = useState<string>("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const eligible = memberIds.filter((id) => !currentOrder.includes(id));
  const canSubmit = outId && inId && !disabled;

  const doReplace = async () => {
    if (!canSubmit) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("ladder_replace_player" as never, {
      p_season_id: seasonId,
      p_out_user_id: outId,
      p_in_user_id: inId,
    } as never);
    setBusy(false);
    setConfirm(false);
    if (error || (data as { ok?: boolean } | null)?.ok === false) {
      toast.error(error?.message ?? "Replace failed");
      return;
    }
    toast.success(`${nameOf(inId)} takes ${nameOf(outId)}'s spot on the ladder`);
    setOutId("");
    setInId("");
    setOpen(false);
    onChanged();
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left"
      >
        <UserMinus className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-sm font-semibold">Someone dropped out?</span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Replace a player"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-muted-foreground">
            Swap a player who's left for a replacement — they inherit the same
            rung, so the ladder stays a multiple of four and nobody else moves.
            Takes effect from the next round.
          </p>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Leaving the ladder
              </label>
              <Select value={outId} onValueChange={setOutId} disabled={disabled}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Pick a player" /></SelectTrigger>
                <SelectContent>
                  {currentOrder.map((id, i) => (
                    <SelectItem key={id} value={id}>#{i + 1} · {nameOf(id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Coming in
              </label>
              <Select value={inId} onValueChange={setInId} disabled={disabled || eligible.length === 0}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder={eligible.length ? "Pick a replacement" : "No eligible members"} />
                </SelectTrigger>
                <SelectContent>
                  {eligible.map((id) => (
                    <SelectItem key={id} value={id}>{nameOf(id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {eligible.length === 0 && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              Everyone active is already on the ladder. Add the replacement on the
              Players tab first, then come back here.
            </p>
          )}

          <ActionButton
            size="sm" variant="destructive" disabled={!canSubmit}
            onClick={() => setConfirm(true)} className="h-9 text-xs"
          >
            Replace player
          </ActionButton>
        </div>
      )}

      <AlertDialog open={confirm} onOpenChange={(o) => { if (!o) setConfirm(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace this player?</AlertDialogTitle>
            <AlertDialogDescription>
              {outId && inId ? (
                <>
                  <strong>{nameOf(inId)}</strong> will take <strong>{nameOf(outId)}</strong>'s
                  spot on the ladder, inheriting their rung. {nameOf(outId)} will be
                  removed from the season. This applies from the next round and can be
                  undone by replacing again.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={doReplace}>
              {busy ? "Replacing…" : "Replace"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
