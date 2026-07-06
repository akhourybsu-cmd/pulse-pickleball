import {
  Trophy, Shuffle, Zap, Sparkles, Layers,
  type LucideIcon,
} from "lucide-react";
import type { LeagueType } from "./types";

/**
 * Single source of truth for how each league type looks and reads.
 * Every league-facing surface (Dashboard card, hub, create flow, hero,
 * standings caption) references this so the visual language and copy
 * stay in lockstep.
 *
 * Adding a new type? Update `LeagueType` in types.ts, then add an
 * entry here — the UI will surface it automatically.
 */
export interface LeagueTypeMeta {
  key: LeagueType;
  label: string;
  /** One-liner shown on cards and in the hero pill. */
  tagline: string;
  /** 2-3 sentence explanation used in the CreateLeagueDialog card. */
  description: string;
  /** Concrete example that helps a first-time reader picture it. */
  example: string;
  icon: LucideIcon;
  /** Tailwind side-rail bg for the entity accent (e.g. "bg-blue-500"). */
  stripe: string;
  /** Tinted chip class (bg + text) for icon chips. */
  chip: string;
  /** Pill class combining bg + text + ring for the hero. */
  pill: string;
}

export const LEAGUE_TYPE_META: Record<LeagueType, LeagueTypeMeta> = {
  singles: {
    key: "singles",
    label: "Singles",
    tagline: "1v1 head-to-head",
    description:
      "Every match is one player against one player. Standings track "
      + "individual records — no teammates, no substitutions.",
    example: "e.g. Tuesday Night Singles Ladder",
    icon: Zap,
    stripe: "bg-blue-500",
    chip: "bg-blue-500/10 text-blue-500",
    pill: "bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30",
  },
  doubles: {
    key: "doubles",
    label: "Doubles",
    tagline: "2v2 with rotating partners or fixed pairs",
    description:
      "The classic pickleball format — two teams of two. Great for "
      + "clubs that want everyone on the court together.",
    example: "e.g. Spring Doubles League — Wednesday nights",
    icon: Shuffle,
    stripe: "bg-emerald-500",
    chip: "bg-emerald-500/10 text-emerald-500",
    pill: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30",
  },
  team: {
    key: "team",
    label: "Team",
    tagline: "Full rosters, weekly matchups",
    description:
      "Multi-player rosters compete week-to-week. Captains manage "
      + "lineups; a match is a bundle of games between two teams.",
    example: "e.g. Corporate Team Nights, 4-5 players per side",
    icon: Trophy,
    stripe: "bg-primary",
    chip: "bg-primary/10 text-primary",
    pill: "bg-[#A6DB5A]/15 text-[#A6DB5A] ring-1 ring-[#A6DB5A]/30",
  },
  flex: {
    key: "flex",
    label: "Flex",
    tagline: "Play on your own schedule",
    description:
      "Members are matched, then set up their own court time by the "
      + "deadline. Perfect for clubs where a fixed night doesn't work.",
    example: "e.g. Monthly Flex — play 3 matches by month end",
    icon: Sparkles,
    stripe: "bg-amber-500",
    chip: "bg-amber-500/10 text-amber-500",
    pill: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30",
  },
  ladder: {
    key: "ladder",
    label: "Ladder",
    tagline: "Climb the ranks — challenge up, defend below",
    description:
      "Players are ranked 1..N. You challenge someone within a few "
      + "rungs to swap positions. Rankings shift every week.",
    example: "e.g. Club Ladder — challenge up to 3 spots above you",
    icon: Layers,
    stripe: "bg-violet-500",
    chip: "bg-violet-500/10 text-violet-500",
    pill: "bg-violet-500/15 text-violet-300 ring-1 ring-violet-500/30",
  },
};

/** Ordered list for iteration in UI. */
export const LEAGUE_TYPES: LeagueType[] = [
  "doubles", "singles", "team", "flex", "ladder",
];
