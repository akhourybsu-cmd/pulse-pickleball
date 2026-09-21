import { CalendarDays, MapPin, Trophy } from "lucide-react";
import type { WizardFormData } from "./hooks/useWizardSteps";

/** A decorative court and the PULSE heartbeat, drawn once on entry. */
export function PulseCourt() {
  return <svg className="rr-pulse-court" viewBox="0 0 320 150" fill="none" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="1">
      <rect x="32" y="15" width="256" height="120" rx="3" />
      <path d="M128 15v120M192 15v120M32 75h96M192 75h96" />
      <path d="M160 8v134" strokeDasharray="3 4" />
    </g>
    <path className="rr-heartbeat" pathLength="1" d="M0 75h93l15-15 15 30 23-62 25 94 20-47h129" stroke="hsl(var(--primary))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle className="rr-court-ball" cx="244" cy="45" r="4" fill="hsl(var(--primary))" />
  </svg>;
}

export function WizardEventPreview({ formData }: { formData: WizardFormData }) {
  const count = formData.eventMode === "open_registration" ? formData.maxPlayers
    : formData.playerInputMethod === "add" ? formData.selectedPlayers.length : formData.playerCount;
  const date = formData.eventMode === "immediate" ? "Today" : formData.eventDate
    ? new Date(formData.eventDate).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Date to come";
  const format = { open: "Open doubles", mixed: "Mixed doubles", male: "Men’s doubles", female: "Women’s doubles" }[formData.format];
  return <aside className="rr-preview" aria-label="Live event summary">
    <div className="rr-event-ticket">
      <div className="rr-ticket-art"><span className="rr-eyebrow">Made for the court.</span><PulseCourt /></div>
      <div className="p-5 xl:p-6">
        <p className="rr-eyebrow text-primary">Your round robin</p>
        <h2 className="mt-3 break-words text-xl font-semibold leading-tight">{formData.eventName.trim() || "A great event starts here."}</h2>
        <p className="mt-2 text-xs text-muted-foreground">{format} · {formData.eventMode === "immediate" ? "Play today" : "Future event"}</p>
        <div className="my-5 space-y-3 text-xs text-muted-foreground">
          <p className="flex items-start gap-2"><MapPin className="h-4 w-4 shrink-0 text-primary" /><span className="break-words">{[formData.locationLabel, formData.cityLabel].filter(Boolean).join(" · ") || "Your chosen location"}</span></p>
          <p className="flex items-center gap-2"><CalendarDays className="h-4 w-4 shrink-0 text-primary" />{date}{formData.startTime ? ` · ${formData.startTime}` : " · Time to come"}</p>
        </div>
        <div className="rr-ticket-metrics">
          {[{ value: count, label: formData.eventMode === "open_registration" ? "Player cap" : "Players" }, { value: formData.courtCount, label: "Courts" }, { value: formData.gamesPerPlayer, label: "Games each" }].map(({ value, label }) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}
        </div>
        <p className="mt-5 flex items-center gap-2 text-xs"><Trophy className="h-4 w-4 text-primary" />{formData.ratingEligible && !formData.allowGuests ? "PULSE rated event" : "Play for the love of it"}</p>
      </div>
    </div>
    <p className="px-3 pt-4 text-center text-[11px] leading-relaxed text-muted-foreground">Your event takes shape as you go.<br />Review everything before you create it.</p>
  </aside>;
}
