import { LeagueBrandMark, LeagueCover } from "./LeagueIdentity";
import type { LeagueBrand } from "@/lib/leagues/branding";
import type { ReactNode } from "react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";
import "./playerLeague.css";

/** A lightweight, code-drawn court: no image download or perpetual animation. */
export function LeagueCourtArt({ className }: { className?: string }) {
  return (
    <svg
      className={cn("league-court-art", className)}
      viewBox="0 0 360 300"
      fill="none"
      aria-hidden="true"
    >
      <g transform="translate(42 35) rotate(-12 138 115)">
        <rect
          x="0"
          y="0"
          width="276"
          height="230"
          rx="18"
          fill="currentColor"
          fillOpacity=".04"
        />
        <path
          className="league-court-draw"
          pathLength="1"
          d="M26 20H250V210H26V20ZM26 115H250M26 84H250M26 146H250M138 20V84M138 146V210"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M16 115H260"
          stroke="currentColor"
          strokeWidth="3"
          strokeDasharray="3 5"
        />
        <circle cx="78" cy="56" r="11" fill="currentColor" fillOpacity=".16" />
        <circle cx="78" cy="56" r="4" fill="currentColor" />
        <circle
          cx="201"
          cy="177"
          r="11"
          fill="currentColor"
          fillOpacity=".16"
        />
        <circle cx="201" cy="177" r="4" fill="currentColor" />
        <circle
          className="league-court-ball"
          cx="172"
          cy="73"
          r="6"
          fill="var(--league-brand-accent, #d8b86a)"
        />
      </g>
    </svg>
  );
}

export function PlayerLeagueStage({
  title,
  description,
  eyebrow,
  children,
  stats,
  compact = false,
  branding,
  showIdentity = false,
}: {
  title: string;
  description?: string | null;
  eyebrow?: ReactNode;
  children?: ReactNode;
  stats?: { label: string; value: ReactNode }[];
  compact?: boolean;
  branding?: LeagueBrand | null;
  showIdentity?: boolean;
}) {
  return (
    <header className={cn("league-stage", compact && "league-stage-compact")}>
      <LeagueCover branding={branding} />
      {!branding?.cover_url && <LeagueCourtArt />}
      <div className="league-stage-content">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Logo compact className="w-20 text-[#faf7ef]" />
          <span className="border-l border-white/25 pl-4 text-[10px] font-bold uppercase tracking-[.22em] text-[color:var(--league-brand-accent,#e6c782)]">
            Leagues
          </span>
        </div>
        {showIdentity && <LeagueBrandMark name={title} branding={branding} className="mt-5 h-20 w-20 text-[80px] ring-1 ring-white/20 shadow-lg" />}
        {eyebrow && (
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-[#e8e3d8]">
            {eyebrow}
          </div>
        )}
        <h1 className="league-stage-title">{title}</h1>
        {description && (
          <p className="mt-3 max-w-xl break-words text-sm leading-relaxed text-[#d4d5cf] sm:text-base">
            {description}
          </p>
        )}
        {children && (
          <div className="mt-5 flex flex-wrap items-center gap-3">
            {children}
          </div>
        )}
      </div>
      {!!stats?.length && (
        <dl className="league-stage-stats">
          {stats.map((stat) => (
            <div key={stat.label} className="min-w-0">
              <dt className="text-[11px] font-medium text-[#c2c9c2]">
                {stat.label}
              </dt>
              <dd className="mt-1 break-words font-display text-xl font-semibold tabular-nums text-[#faf7ef] sm:text-2xl">
                {stat.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  );
}

export function leagueSessionTime(time: string | null) {
  if (!time) return "Time to be announced";
  const [hour, minute] = time.split(":").map(Number);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function LeagueDateTile({ date }: { date: string | null }) {
  const parsed = date ? new Date(`${date}T12:00:00`) : null;
  return (
    <div className="league-date-tile" aria-hidden="true">
      <span>
        {parsed
          ? parsed.toLocaleDateString(undefined, { month: "short" })
          : "Date"}
      </span>
      <strong>{parsed ? parsed.getDate() : "TBA"}</strong>
    </div>
  );
}
