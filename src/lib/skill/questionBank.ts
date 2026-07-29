/**
 * PULSE Skill Assessment — versioned starter question bank (v1).
 *
 * Data-driven on purpose: items live here (and, in production, in the
 * `skill_assessment_items` table seeded from this file), NEVER hard-coded
 * inside page components. Each item describes an observable in-game
 * behavior, is answerable on the shared response scale, and is pinned to
 * a hidden anchor level.
 *
 * Anchor levels are internal calibration only and must never be shown to
 * players. Foundation-phase items are asked of everyone; targeted-phase
 * items are gated by the adaptive engine.
 */
import {
  ASSESSMENT_VERSION,
  type AnchorLevel,
  type AdaptiveRule,
  type AssessmentItem,
  type Dimension,
  type Domain,
  type ItemPhase,
  type PrerequisiteRule,
  type Subskill,
  isEssentialSubskill,
} from "./model";

interface Draft {
  key: string;
  text: string;
  domain: Domain;
  subskill: Subskill;
  dimension: Dimension | null;
  anchor: AnchorLevel;
  weight?: number;
  essential?: boolean;
  contradiction?: string;
  phase: ItemPhase;
  prereq?: PrerequisiteRule;
  adaptive?: AdaptiveRule;
}

const F: ItemPhase = "foundation";
const T: ItemPhase = "targeted";

/* Compact drafts — real, observable statements spanning anchor levels.
   `text` follows the question-writing standards (observable behavior,
   plain language, near-level opponents, execution vs decision split). */
const DRAFTS: Draft[] = [
  /* -------- Rally foundation & rules (4) -------- */
  { key: "rf_rules_basic", text: "I know the two-bounce rule and the kitchen (non-volley zone) rules well enough that I rarely make a rules mistake in a game.", domain: "rally_foundation", subskill: "positioning", dimension: null, anchor: 2.0, phase: F },
  { key: "rf_keep_rally", text: "In an easy warm-up rally against a similar player, I can keep the ball in play for several shots without a careless error.", domain: "rally_foundation", subskill: "forehand", dimension: "consistency", anchor: 2.0, phase: F },
  { key: "rf_ready_position", text: "Between shots I return to a balanced ready position with my paddle up.", domain: "rally_foundation", subskill: "positioning", dimension: "application", anchor: 2.5, phase: F },
  { key: "rf_shot_purpose", text: "During points I have a clear intention for most shots rather than just returning the ball anywhere.", domain: "rally_foundation", subskill: "strategy", dimension: "application", anchor: 3.0, phase: F },

  /* -------- Serve (5) -------- */
  { key: "sv_legal", text: "I place at least about eight of ten ordinary serves into the correct service court during normal games.", domain: "serve_return", subskill: "serve", dimension: "consistency", anchor: 2.0, phase: F, essential: true, contradiction: "serve_reliability" },
  { key: "sv_depth", text: "I can serve deep enough that my opponent usually has to hit their return from near their baseline.", domain: "serve_return", subskill: "serve", dimension: "execution", anchor: 3.0, phase: F, essential: true },
  { key: "sv_direction", text: "I can aim my serve to a chosen side of the service box on demand.", domain: "serve_return", subskill: "serve", dimension: "application", anchor: 3.5, phase: T },
  { key: "sv_spin_pace", text: "I can add spin or pace to my serve while still keeping it in.", domain: "serve_return", subskill: "serve", dimension: "execution", anchor: 4.0, phase: T },
  { key: "sv_pressure", text: "On important points I still serve aggressively without giving away easy faults.", domain: "serve_return", subskill: "serve", dimension: "pressure", anchor: 4.0, phase: T },

  /* -------- Return of serve (5) -------- */
  { key: "rt_reliable", text: "I get the large majority of ordinary serves back in play.", domain: "serve_return", subskill: "return", dimension: "consistency", anchor: 2.0, phase: F, essential: true, contradiction: "return_reliability" },
  { key: "rt_advance", text: "My return usually gives me enough time to move up toward the kitchen line.", domain: "serve_return", subskill: "return", dimension: "application", anchor: 3.0, phase: F, essential: true, contradiction: "kitchen_presence" },
  { key: "rt_depth", text: "I can return deep enough to push my opponent back and slow their approach.", domain: "serve_return", subskill: "return", dimension: "execution", anchor: 3.5, phase: T },
  { key: "rt_bh_control", text: "I can return reliably from my backhand side, not just my forehand.", domain: "serve_return", subskill: "return", dimension: "execution", anchor: 3.5, phase: T },
  { key: "rt_tough_serve", text: "I can handle spinny or fast serves without popping the return up.", domain: "serve_return", subskill: "return", dimension: "pressure", anchor: 4.0, phase: T },

  /* -------- Forehand groundstroke (4) -------- */
  { key: "fh_consistent", text: "My forehand groundstroke stays in play through a normal neutral rally.", domain: "baseline_offense", subskill: "forehand", dimension: "consistency", anchor: 2.5, phase: F },
  { key: "fh_depth_dir", text: "I can hit my forehand deep and to a chosen side on purpose.", domain: "baseline_offense", subskill: "forehand", dimension: "application", anchor: 3.5, phase: T },
  { key: "fh_pace_control", text: "I can add pace to my forehand without spraying it out or into the net.", domain: "baseline_offense", subskill: "forehand", dimension: "execution", anchor: 4.0, phase: T },
  { key: "fh_neutral_vs_offense", text: "I choose when to drive my forehand versus keep it neutral based on the ball I get.", domain: "baseline_offense", subskill: "forehand", dimension: "application", anchor: 4.0, phase: T },

  /* -------- Backhand groundstroke (4) -------- */
  { key: "bh_consistent", text: "My backhand groundstroke stays in play through a normal neutral rally.", domain: "baseline_offense", subskill: "backhand", dimension: "consistency", anchor: 2.5, phase: F, contradiction: "backhand_gap" },
  { key: "bh_depth_dir", text: "I can hit my backhand deep and to a chosen side on purpose.", domain: "baseline_offense", subskill: "backhand", dimension: "application", anchor: 3.5, phase: T },
  { key: "bh_under_pressure", text: "I can keep my backhand controlled even when the ball comes fast at that side.", domain: "baseline_offense", subskill: "backhand", dimension: "pressure", anchor: 4.0, phase: T, contradiction: "backhand_gap" },
  { key: "bh_error_control", text: "I rarely give away free points from my backhand side in a normal game.", domain: "baseline_offense", subskill: "backhand", dimension: "consistency", anchor: 3.5, phase: T },

  /* -------- Drive (5) -------- */
  { key: "dr_forehand", text: "I can hit a controlled forehand drive that clears the net and lands in.", domain: "baseline_offense", subskill: "drive", dimension: "execution", anchor: 3.0, phase: F },
  { key: "dr_backhand", text: "I can hit a controlled backhand drive when the situation calls for it.", domain: "baseline_offense", subskill: "drive", dimension: "execution", anchor: 3.5, phase: T },
  { key: "dr_target", text: "I aim my drives at feet or gaps rather than just hitting hard.", domain: "baseline_offense", subskill: "drive", dimension: "application", anchor: 4.0, phase: T, contradiction: "drive_quality" },
  { key: "dr_selection", text: "I choose between a third-shot drive and a drop based on ball height, my balance, and opponent position.", domain: "baseline_offense", subskill: "drive", dimension: "application", anchor: 4.0, phase: T, contradiction: "drive_quality" },
  { key: "dr_next_ball", text: "After driving I am ready to handle the next ball and move in behind a good drive.", domain: "baseline_offense", subskill: "drive", dimension: "pressure", anchor: 4.5, phase: T },

  /* -------- Third-shot drop (6) -------- */
  { key: "ts_fh_drop", text: "I can hit a soft forehand third shot that lands in or near the kitchen more often than not.", domain: "soft_game", subskill: "third_shot_drop", dimension: "execution", anchor: 3.0, phase: F, essential: true, contradiction: "soft_third" },
  { key: "ts_bh_drop", text: "I can hit a soft backhand third shot when needed.", domain: "soft_game", subskill: "third_shot_drop", dimension: "execution", anchor: 3.5, phase: T, essential: true },
  { key: "ts_height", text: "My third-shot drops usually stay low enough that they aren't easy to attack.", domain: "soft_game", subskill: "third_shot_drop", dimension: "consistency", anchor: 3.5, phase: T, essential: true },
  { key: "ts_placement", text: "I can place my drop crosscourt or straight depending on the situation.", domain: "soft_game", subskill: "third_shot_drop", dimension: "application", anchor: 4.0, phase: T },
  { key: "ts_follow", text: "I move forward behind my drop rather than staying at the baseline.", domain: "soft_game", subskill: "third_shot_drop", dimension: "application", anchor: 3.5, phase: T, contradiction: "kitchen_presence" },
  { key: "ts_pressure", text: "I can execute a drop under pressure late in a close game.", domain: "soft_game", subskill: "third_shot_drop", dimension: "pressure", anchor: 4.5, phase: T },

  /* -------- Dinking mechanics (6) -------- */
  { key: "dk_tolerance", text: "I can sustain a cooperative dink rally at the kitchen without rushing to end it.", domain: "soft_game", subskill: "dinking", dimension: "consistency", anchor: 3.0, phase: F, essential: true },
  { key: "dk_height", text: "I can keep my neutral dinks low enough that they aren't immediately attackable.", domain: "soft_game", subskill: "dinking", dimension: "execution", anchor: 3.5, phase: F, essential: true, contradiction: "dink_control" },
  { key: "dk_crosscourt", text: "I can dink crosscourt with control.", domain: "soft_game", subskill: "dinking", dimension: "execution", anchor: 3.0, phase: T },
  { key: "dk_bh", text: "I can dink reliably off my backhand, not just my forehand.", domain: "soft_game", subskill: "dinking", dimension: "execution", anchor: 3.5, phase: T },
  { key: "dk_placement", text: "I can place dinks to move my opponent around rather than just returning them.", domain: "soft_game", subskill: "dinking", dimension: "application", anchor: 4.0, phase: T },
  { key: "dk_recover", text: "After being pulled off the court by a dink I can recover position without popping the next ball up.", domain: "soft_game", subskill: "dinking", dimension: "pressure", anchor: 4.0, phase: T, contradiction: "dink_control" },

  /* -------- Dink strategy & patience (5) -------- */
  { key: "ds_attackable", text: "I can tell the difference between an attackable ball and one I should keep dinking.", domain: "soft_game", subskill: "dink_strategy", dimension: "application", anchor: 3.5, phase: F, contradiction: "attack_selection" },
  { key: "ds_patience", text: "I am willing to keep dinking and wait for a mistake rather than forcing a low-percentage attack.", domain: "soft_game", subskill: "dink_strategy", dimension: "application", anchor: 3.5, phase: T, contradiction: "attack_selection" },
  { key: "ds_patterns", text: "I build dink patterns (for example, pulling someone wide before going behind them).", domain: "soft_game", subskill: "dink_strategy", dimension: "application", anchor: 4.0, phase: T },
  { key: "ds_direction", text: "I change dink direction to create openings without giving away easy attacks.", domain: "soft_game", subskill: "dink_strategy", dimension: "application", anchor: 4.0, phase: T },
  { key: "ds_respond_speedup", text: "When an opponent speeds a ball up out of a dink, I usually respond without panicking.", domain: "soft_game", subskill: "dink_strategy", dimension: "pressure", anchor: 4.0, phase: T },

  /* -------- Speedups & attacks (4) -------- */
  { key: "sp_recognize", text: "I recognize when a dink has come up high enough to attack.", domain: "net_offense", subskill: "speedups", dimension: "application", anchor: 3.5, phase: T, contradiction: "attack_selection" },
  { key: "sp_execute", text: "I can speed a ball up off both my forehand and backhand when I get the chance.", domain: "net_offense", subskill: "speedups", dimension: "execution", anchor: 4.0, phase: T },
  { key: "sp_target", text: "My speedups target the body or a gap rather than going straight at the paddle.", domain: "net_offense", subskill: "speedups", dimension: "application", anchor: 4.0, phase: T },
  { key: "sp_recover", text: "After I attack I stay ready to handle the counter rather than admiring the shot.", domain: "net_offense", subskill: "speedups", dimension: "pressure", anchor: 4.5, phase: T },

  /* -------- Counters & hands (4) -------- */
  { key: "ct_prep", text: "I keep my paddle up and ready so I can react to a sudden speedup.", domain: "net_offense", subskill: "counters", dimension: "application", anchor: 3.5, phase: T },
  { key: "ct_compact", text: "I can block or counter a fast ball with a compact, controlled motion.", domain: "net_offense", subskill: "counters", dimension: "execution", anchor: 4.0, phase: T },
  { key: "ct_redirect", text: "I can redirect an opponent's pace to an open spot rather than just blocking it back.", domain: "net_offense", subskill: "counters", dimension: "application", anchor: 4.5, phase: T },
  { key: "ct_exchanges", text: "I can hold up in a fast hands exchange at the net against similar players.", domain: "net_offense", subskill: "counters", dimension: "pressure", anchor: 4.5, phase: T },

  /* -------- Volleys (4) -------- */
  { key: "vl_punch", text: "I can hit a controlled punch volley that stays in.", domain: "net_offense", subskill: "volleys", dimension: "execution", anchor: 3.0, phase: F },
  { key: "vl_direction", text: "I can direct my volleys to a chosen side.", domain: "net_offense", subskill: "volleys", dimension: "application", anchor: 3.5, phase: T },
  { key: "vl_low", text: "I can handle low volleys near the kitchen without popping them up.", domain: "net_offense", subskill: "volleys", dimension: "execution", anchor: 4.0, phase: T },
  { key: "vl_finish", text: "I can finish a clearly high ball at the net without over-hitting it.", domain: "net_offense", subskill: "volleys", dimension: "pressure", anchor: 4.0, phase: T },

  /* -------- Resets & defense (6) -------- */
  { key: "rs_block", text: "I can block a hard-driven ball back into play when I'm at the net.", domain: "defense", subskill: "resets_defense", dimension: "execution", anchor: 3.0, phase: F, essential: true },
  { key: "rs_feet", text: "I can absorb pace and reset some balls hit at my feet in the transition zone.", domain: "defense", subskill: "resets_defense", dimension: "execution", anchor: 3.5, phase: F, essential: true, contradiction: "reset_claim" },
  { key: "rs_kitchen", text: "At the kitchen line I can soften a hard ball back into the kitchen instead of popping it up.", domain: "defense", subskill: "resets_defense", dimension: "consistency", anchor: 4.0, phase: T, essential: true, contradiction: "reset_claim" },
  { key: "rs_absorb", text: "I stay calm and absorb pace rather than swinging hard when I'm under attack.", domain: "defense", subskill: "resets_defense", dimension: "application", anchor: 4.0, phase: T },
  { key: "rs_neutralize", text: "I can neutralize a speedup and get the point back to neutral.", domain: "defense", subskill: "resets_defense", dimension: "pressure", anchor: 4.0, phase: T },
  { key: "rs_recover", text: "I can turn a defensive position back into a neutral or offensive one over a few shots.", domain: "defense", subskill: "resets_defense", dimension: "pressure", anchor: 4.5, phase: T },

  /* -------- Transition-zone play (6) -------- */
  { key: "tz_reach_kitchen", text: "After serving or returning I make it up to the kitchen line during most points.", domain: "transition", subskill: "transition_play", dimension: "application", anchor: 3.0, phase: F, contradiction: "kitchen_presence" },
  { key: "tz_behind_shot", text: "I move forward behind a good shot rather than charging in behind a weak one.", domain: "transition", subskill: "transition_play", dimension: "application", anchor: 3.5, phase: T },
  { key: "tz_split_step", text: "I split-step as my opponent contacts the ball so I can react while moving up.", domain: "transition", subskill: "transition_play", dimension: "execution", anchor: 4.0, phase: T },
  { key: "tz_when_stop", text: "I know when to stop and reset in the transition zone instead of running through it.", domain: "transition", subskill: "transition_play", dimension: "application", anchor: 4.0, phase: T },
  { key: "tz_unsafe", text: "I recognize when advancing is unsafe and hold my position instead.", domain: "transition", subskill: "transition_play", dimension: "application", anchor: 4.0, phase: T },
  { key: "tz_with_partner", text: "I move up and back with my partner so we don't get split in the transition zone.", domain: "transition", subskill: "transition_play", dimension: "application", anchor: 4.5, phase: T },

  /* -------- Overheads & lobs (4) -------- */
  { key: "oh_reliable", text: "I can hit a reliable overhead on a ball I can reach comfortably.", domain: "net_offense", subskill: "overheads_lobs", dimension: "execution", anchor: 3.5, phase: T },
  { key: "oh_let_go", text: "I recognize when an opponent's lob is likely going out and let it go.", domain: "net_offense", subskill: "overheads_lobs", dimension: "application", anchor: 4.0, phase: T },
  { key: "oh_lob_select", text: "I use an offensive lob only when it's a good option, not as a panic shot.", domain: "net_offense", subskill: "overheads_lobs", dimension: "application", anchor: 4.0, phase: T },
  { key: "oh_switch", text: "When I'm lobbed, my partner and I switch and recover rather than colliding.", domain: "net_offense", subskill: "overheads_lobs", dimension: "pressure", anchor: 4.5, phase: T },

  /* -------- Positioning & partnership (6) -------- */
  { key: "ps_start", text: "I start points in a sensible court position for my role (server, returner, partner).", domain: "positioning_teamwork", subskill: "positioning", dimension: "application", anchor: 2.5, phase: F, essential: true, contradiction: "position_basics" },
  { key: "ps_advance", text: "I understand that the returning team should advance to the kitchen after the return.", domain: "positioning_teamwork", subskill: "positioning", dimension: "application", anchor: 3.0, phase: F, essential: true, contradiction: "position_basics" },
  { key: "ps_lateral", text: "I move laterally with my partner rather than leaving a large open gap.", domain: "positioning_teamwork", subskill: "positioning", dimension: "application", anchor: 3.5, phase: T, essential: true },
  { key: "ps_middle", text: "My partner and I have a clear understanding of who takes balls down the middle.", domain: "positioning_teamwork", subskill: "positioning", dimension: "application", anchor: 4.0, phase: T },
  { key: "ps_switch", text: "We switch sides and cover for each other when the situation calls for it.", domain: "positioning_teamwork", subskill: "positioning", dimension: "application", anchor: 4.0, phase: T },
  { key: "ps_communicate", text: "I communicate with my partner during points (calls like 'mine', 'yours', 'switch', 'out').", domain: "positioning_teamwork", subskill: "positioning", dimension: "application", anchor: 3.5, phase: T },

  /* -------- Strategy & competitive execution (6) -------- */
  { key: "st_shot_selection", text: "I usually pick a sensible shot for the situation rather than the flashiest option.", domain: "strategy", subskill: "strategy", dimension: "application", anchor: 3.0, phase: F },
  { key: "st_weakness", text: "I look for and target an opponent's weaker side or weaker player.", domain: "strategy", subskill: "strategy", dimension: "application", anchor: 3.5, phase: T },
  { key: "st_adapt", text: "I can change strategy when the same pattern repeatedly loses points.", domain: "strategy", subskill: "strategy", dimension: "application", anchor: 4.0, phase: T },
  { key: "st_error_mgmt", text: "I manage my own errors — I don't keep forcing the shot that's been missing.", domain: "strategy", subskill: "strategy", dimension: "pressure", anchor: 4.0, phase: T },
  { key: "st_slow_down", text: "I recognize when to slow a point down and reset rather than speeding up.", domain: "strategy", subskill: "strategy", dimension: "application", anchor: 4.0, phase: T },
  { key: "st_pressure", text: "I execute my game plan on important points, not just when I'm comfortably ahead.", domain: "strategy", subskill: "strategy", dimension: "pressure", anchor: 4.5, phase: T },
];

/** Build the immutable, ordered item bank for the current version. */
function build(): AssessmentItem[] {
  return DRAFTS.map((d, i) => ({
    itemKey: d.key,
    version: ASSESSMENT_VERSION,
    text: d.text,
    domain: d.domain,
    subskill: d.subskill,
    dimension: d.dimension,
    anchorLevel: d.anchor,
    weight: d.weight ?? 1,
    isEssential: d.essential ?? isEssentialSubskill(d.subskill),
    contradictionGroup: d.contradiction ?? null,
    prerequisite: d.prereq ?? null,
    adaptive: d.adaptive ?? null,
    phase: d.phase,
    order: i,
    active: true,
  }));
}

export const QUESTION_BANK_V1: readonly AssessmentItem[] = Object.freeze(build());

/** Lookup helper. */
export function itemByKey(key: string): AssessmentItem | undefined {
  return QUESTION_BANK_V1.find((it) => it.itemKey === key);
}

/** Items presented to every player before adaptive branching. */
export const FOUNDATION_ITEMS: readonly AssessmentItem[] = Object.freeze(
  QUESTION_BANK_V1.filter((it) => it.phase === "foundation"),
);
