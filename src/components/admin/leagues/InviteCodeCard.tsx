import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Copy, Trash2, Check } from "lucide-react";
import type { League } from "@/lib/leagues/types";
import { logLeagueAction } from "@/lib/leagues/audit";

/**
 * Invite-code panel for the admin League Overview tab.
 *
 * Custom string, admin-controlled. Distributes out-of-band (SMS,
 * flyer, community post). Case-insensitively unique across the whole
 * league table. Format: A-Z 0-9 _ - only, 4–32 chars.
 *
 * Setting a code on an admin_only league is technically allowed by the
 * DB, but there's no player-facing lookup path — the join RPC skips
 * admin_only. So we surface a subtle warning here to prevent confusion.
 */
export function InviteCodeCard({
  league, onMutated,
}: {
  league: League;
  onMutated: () => void;
}) {
  const [draft, setDraft] = useState(league.invite_code ?? "");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentCode = league.invite_code ?? null;
  const isAdminOnly = league.visibility === "admin_only";
  const trimmed = draft.trim();
  const dirty = trimmed !== (currentCode ?? "");
  const format = /^[A-Za-z0-9_-]{4,32}$/;
  const validForSave = trimmed === "" || format.test(trimmed);

  const save = async () => {
    if (!validForSave) {
      toast.error("Code must be 4–32 letters, numbers, hyphens or underscores");
      return;
    }
    setSaving(true);
    const nextValue: string | null = trimmed === "" ? null : trimmed;
    const { error } = await supabase
      .from("leagues" as never)
      .update({ invite_code: nextValue } as never)
      .eq("id", league.id);
    if (error) {
      // Uniqueness violations bubble up as 23505. Give the admin a real
      // hint rather than the raw Postgres message.
      const msg = error.code === "23505"
        ? "That code is already in use by another league. Pick a different one."
        : error.message;
      toast.error(msg);
      setSaving(false);
      return;
    }
    await logLeagueAction({
      leagueId: league.id,
      action: nextValue ? "league.invite_code_set" : "league.invite_code_cleared",
      entityType: "league",
      entityId: league.id,
      oldValue: { invite_code: currentCode },
      newValue: { invite_code: nextValue },
    });
    toast.success(nextValue ? "Invite code updated" : "Invite code cleared");
    setSaving(false);
    onMutated();
  };

  const copy = async () => {
    if (!currentCode) return;
    try {
      await navigator.clipboard.writeText(currentCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  return (
    <div className="rounded-xl border border-border/70 bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">Invite code</h3>
      </div>

      <p className="text-xs text-muted-foreground">
        Pick a memorable code (e.g. <code className="text-[11px] font-mono px-1 rounded bg-muted">SPRING26</code>).
        Players enter it on the Join screen to become an active member. Case-insensitive.
      </p>

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. SPRING26"
            className="font-mono uppercase h-10 tracking-wider"
            maxLength={32}
          />
        </div>
        {currentCode && !dirty && (
          <Button variant="outline" size="sm" onClick={copy} className="h-10 shrink-0">
            {copied ? (
              <><Check className="w-4 h-4 mr-1.5 text-emerald-500" />Copied</>
            ) : (
              <><Copy className="w-4 h-4 mr-1.5" />Copy</>
            )}
          </Button>
        )}
        <Button
          size="sm"
          onClick={save}
          disabled={saving || !dirty || !validForSave}
          className="h-10 shrink-0"
        >
          {saving ? "Saving…" : dirty && !trimmed ? "Clear" : "Save"}
        </Button>
      </div>

      {/* Format guidance shown only when the user has typed something
          invalid. Silence otherwise. */}
      {trimmed !== "" && !validForSave && (
        <p className="text-[11px] text-destructive">
          Codes must be 4–32 characters, letters/numbers/hyphens/underscores only.
        </p>
      )}

      {isAdminOnly && currentCode && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-700 dark:text-amber-300">
          Heads up — this league's visibility is <strong>admin_only</strong>, so the
          code won't work for players. Change visibility to <em>private</em> or{" "}
          <em>public_future</em> once you're ready to open joins.
        </div>
      )}

      {currentCode && !dirty && (
        <div className="rounded-md bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-start gap-2">
          <Trash2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            To disable joins, clear the field and press Save. Existing
            members stay put.
          </span>
        </div>
      )}
    </div>
  );
}
