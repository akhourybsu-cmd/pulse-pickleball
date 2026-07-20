import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Trophy, Sparkles, Lock, ExternalLink, ArrowLeft, ArrowRight, Check,
} from "lucide-react";
import type { LeagueType } from "@/lib/leagues/types";
import { LEAGUE_TYPE_META } from "@/lib/leagues/typeMeta";
import { useLeagueCreationCapacity } from "@/hooks/useLeagueCreationCapacity";
import { cn } from "@/lib/utils";

/**
 * Curated create options, in display order. Ladder is the marquee setup;
 * "Basic League" is a plain manual league (organizer runs the schedule).
 * More formats (singles, team, flex) exist as league types but aren't
 * surfaced here yet — we're focusing the create flow on the ladder.
 */
type CreateKey = "ladder" | "basic";
interface CreateOption {
  key: CreateKey;
  /** Underlying league_type persisted for this option. */
  leagueType: LeagueType;
  title: string;
  tagline: string;
  description: string;
  example: string;
  marquee?: boolean;
}
const CREATE_OPTIONS: CreateOption[] = [
  {
    key: "ladder",
    leagueType: "ladder",
    marquee: true,
    title: "Individual Doubles Ladder",
    tagline: "Automated · rotating partners",
    description:
      "Players are ranked individually and split into groups of four each week. "
      + "Everyone rotates partners across three games, then the ladder automatically "
      + "moves winners up a court and losers down.",
    example: "Best for a weekly club ladder night",
  },
  {
    key: "basic",
    leagueType: "doubles",
    title: "Basic League",
    tagline: "Manual · you run it",
    description:
      "A simple league with no automation. You set up the seasons, sessions, and "
      + "matchups and enter scores yourself — full manual control.",
    example: "Best for casual round-robin or social nights",
  },
];

/**
 * Two-step self-serve league creation.
 *
 *   Step 1 — Pick a league type. Visual cards explain each format so
 *   a first-time creator doesn't have to guess what "Flex" means.
 *
 *   Step 2 — Name, description, location. Type is fixed and previewed
 *   as a compact pill.
 *
 * On the second step's submit we call create_league via RPC. A quota
 * failure (SQLSTATE 53300) flips to the paywall view without losing
 * the form state.
 */
export function CreateLeagueDialog({
  open, onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { capacity } = useLeagueCreationCapacity();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedKey, setSelectedKey] = useState<CreateKey>("ladder");
  const selected = CREATE_OPTIONS.find((o) => o.key === selectedKey) ?? CREATE_OPTIONS[0];
  const leagueType = selected.leagueType;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const openCheckout = async () => {
    setCheckoutLoading(true);
    const { data, error } = await supabase.functions.invoke(
      "create-league-checkout", { body: {} },
    );
    setCheckoutLoading(false);
    if (error) { toast.error(error.message ?? "Couldn't open checkout"); return; }
    const url = (data as { url?: string } | null)?.url;
    if (!url) { toast.error("Checkout URL missing"); return; }
    window.location.href = url;
  };

  const reset = () => {
    setStep(1);
    setSelectedKey("ladder");
    setName(""); setDescription(""); setLocation("");
    setSaving(false);
    setQuotaExceeded(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const submit = async () => {
    if (!name.trim()) { toast.error("League name is required"); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc("create_league" as never, {
      p_name: name.trim(),
      p_description: description.trim() || null,
      p_location: location.trim() || null,
      p_league_type: leagueType,
    } as never);
    setSaving(false);

    if (error) {
      const hint = (error as { hint?: string } | null)?.hint;
      const code = (error as { code?: string } | null)?.code;
      if (hint === "league_quota_exceeded" || code === "53300") {
        setQuotaExceeded(true);
        return;
      }
      toast.error(error.message);
      return;
    }

    toast.success("League created — let's set it up");
    handleClose(false);
    navigate(`/player/leagues/${data as unknown as string}/manage`);
  };

  const selectedMeta = LEAGUE_TYPE_META[leagueType];
  const SelectedIcon = selectedMeta.icon;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden gap-0">
        {quotaExceeded ? (
          <PaywallView
            capacity={capacity}
            checkoutLoading={checkoutLoading}
            onCheckout={openCheckout}
            onClose={() => handleClose(false)}
          />
        ) : (
          <>
            {/* Gold accent stripe — brand signature */}
            <div className="h-1.5 w-full bg-[#A6DB5A]" aria-hidden />

            <DialogHeader className="p-5 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <DialogTitle className="text-lg font-bold tracking-tight leading-tight flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-primary" />
                    Create your league
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {step === 1
                      ? "Step 1 of 2 · Pick a format"
                      : "Step 2 of 2 · Basics"}
                  </p>
                </div>
                <StepIndicator step={step} />
              </div>
            </DialogHeader>

            {/* Body — animated crossfade between steps */}
            <div className="px-5 pb-4 max-h-[65vh] overflow-y-auto">
              <AnimatePresence mode="wait" initial={false}>
                {step === 1 ? (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="space-y-2.5"
                  >
                    {CREATE_OPTIONS.map((opt, i) => (
                      <motion.div
                        key={opt.key}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: i * 0.05 }}
                      >
                        <CreateOptionCard
                          option={opt}
                          selected={selectedKey === opt.key}
                          onSelect={() => setSelectedKey(opt.key)}
                        />
                      </motion.div>
                    ))}
                    <p className="text-[11px] text-center text-muted-foreground pt-1">
                      More formats (singles, team, flex) coming soon.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                    className="space-y-4"
                  >
                    {/* Selected-type recap chip */}
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className={cn(
                        "w-full text-left rounded-lg border border-border/60 bg-muted/30 p-3",
                        "flex items-center gap-3 group hover:border-border hover:bg-muted/50 transition-colors",
                      )}
                    >
                      <div className={cn(
                        "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                        selectedMeta.chip,
                      )}>
                        <SelectedIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          Format
                        </div>
                        <div className="text-sm font-semibold truncate">
                          {selected.title}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {selected.tagline}
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground group-hover:text-foreground">
                        Change
                      </span>
                    </button>

                    <div className="space-y-1.5">
                      <Label htmlFor="new-league-name" className="text-xs font-semibold">
                        League name <span className="text-[#A6DB5A]">*</span>
                      </Label>
                      <Input
                        id="new-league-name" value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={selectedKey === "ladder" ? "e.g. Tuesday Night Ladder" : "e.g. Fall Doubles League"}
                        className="h-11" autoFocus
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-league-desc" className="text-xs font-semibold">
                        Description
                      </Label>
                      <Textarea
                        id="new-league-desc" rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Give players a sense of what to expect."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="new-league-location" className="text-xs font-semibold">
                        Location
                      </Label>
                      <Input
                        id="new-league-location" value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="Venue name, city, or 'Various'"
                        className="h-11"
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                      Your first league is free. Starts as a draft — invite
                      players once you've scaffolded seasons and divisions.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <DialogFooter className="p-4 pt-3 border-t border-border/60 bg-muted/20 gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
              {step === 2 && (
                <Button
                  variant="ghost"
                  onClick={() => setStep(1)}
                  disabled={saving}
                  className="h-11"
                >
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
                </Button>
              )}
              {step === 1 ? (
                <Button
                  onClick={() => setStep(2)}
                  className="h-11 flex-1 font-semibold shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)] active:scale-[0.98] transition-transform"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              ) : (
                <Button
                  onClick={submit}
                  disabled={saving || !name.trim()}
                  className="h-11 flex-1 font-semibold shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.4)] active:scale-[0.98] transition-transform"
                >
                  {saving ? "Creating…" : (
                    <>Create league <Check className="w-4 h-4 ml-1.5" /></>
                  )}
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Tappable, keyboard-accessible card for one create option. The marquee
 * option (Ladder) gets a larger icon + a "Featured" badge. Icon chip +
 * accent rail use the underlying league type's tonal signature.
 */
function CreateOptionCard({
  option, selected, onSelect,
}: {
  option: CreateOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const meta = LEAGUE_TYPE_META[option.leagueType];
  const Icon = meta.icon;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-xl border p-3.5 flex gap-3 items-start relative overflow-hidden",
        "transition-all active:scale-[0.995]",
        selected
          ? "border-primary/50 bg-primary/[0.04] ring-2 ring-primary/30 shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.35)]"
          : "border-border/60 bg-card hover:border-border hover:bg-muted/30",
      )}
      aria-pressed={selected}
    >
      {selected && (
        <div className={cn("absolute top-0 bottom-0 left-0 w-1", meta.stripe)} aria-hidden />
      )}
      <div className={cn(
        "rounded-xl flex items-center justify-center shrink-0",
        option.marquee ? "h-12 w-12" : "h-11 w-11",
        meta.chip,
      )}>
        <Icon className={option.marquee ? "w-6 h-6" : "w-5 h-5"} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("font-bold", option.marquee ? "text-base" : "text-sm")}>
            {option.title}
          </span>
          {option.marquee && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-primary/15 text-primary ring-1 ring-primary/25">
              Featured
            </span>
          )}
          <span className="text-[11px] text-muted-foreground">{option.tagline}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
          {option.description}
        </p>
        <p className="text-[11px] text-muted-foreground/70 mt-1 italic">
          {option.example}
        </p>
      </div>
      {selected && (
        <div className="h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
          <Check className="w-3 h-3" />
        </div>
      )}
    </button>
  );
}

function StepIndicator({ step }: { step: 1 | 2 }) {
  return (
    <div className="flex items-center gap-1.5 shrink-0 pt-1">
      {[1, 2].map((n) => (
        <div
          key={n}
          className={cn(
            "h-1.5 rounded-full transition-all",
            step === n ? "w-6 bg-primary" : "w-3 bg-muted",
          )}
        />
      ))}
    </div>
  );
}

function PaywallView({
  capacity, checkoutLoading, onCheckout, onClose,
}: {
  capacity: ReturnType<typeof useLeagueCreationCapacity>["capacity"];
  checkoutLoading: boolean;
  onCheckout: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <div className="h-1.5 w-full bg-amber-500" aria-hidden />
      <DialogHeader className="p-5 pb-3">
        <DialogTitle className="text-lg font-bold tracking-tight leading-tight flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-600" />
          Add another league
        </DialogTitle>
      </DialogHeader>
      <div className="px-5 pb-4 space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your first league is on us. Additional leagues need a slot —
          one-time purchase, no subscription.
        </p>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            Every slot unlocks one more league — run a Singles ladder,
            a Doubles night, and a Team season all under one account.
          </span>
        </div>
        {capacity && (
          <div className="rounded-md bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-baseline justify-between">
            <span>You currently own</span>
            <span className="font-mono font-semibold tabular-nums">
              {capacity.owned} of {capacity.maxLeagues} allowed
            </span>
          </div>
        )}
      </div>
      <DialogFooter className="p-4 pt-3 border-t border-border/60 bg-muted/20 gap-2 sm:gap-2 flex-col-reverse sm:flex-row">
        <Button variant="ghost" onClick={onClose} className="h-11"
          disabled={checkoutLoading}>
          Not now
        </Button>
        <Button
          onClick={onCheckout}
          className="h-11 flex-1"
          disabled={checkoutLoading}
        >
          {checkoutLoading ? "Opening…" : (
            <>Buy another slot <ExternalLink className="w-3.5 h-3.5 ml-1.5" /></>
          )}
        </Button>
      </DialogFooter>
    </>
  );
}
