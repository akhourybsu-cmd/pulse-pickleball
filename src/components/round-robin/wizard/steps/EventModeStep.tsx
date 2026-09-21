import { CalendarClock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { StepHeader } from "../StepHeader";
import { SelectionTick } from "../SelectionTick";
import { PRESSABLE_CARD } from "@/lib/motion";

const OPTION_BASE =
  "rr-mode-choice relative rounded-2xl border-2 text-left transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 " +
  PRESSABLE_CARD;

interface EventModeStepProps {
  value: "immediate" | "open_registration";
  onChange: (value: "immediate" | "open_registration") => void;
}

export function EventModeStep({ value, onChange }: EventModeStepProps) {
  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={Zap}
        title="Every great event starts with a plan."
        description="Choose when to play. Make the rest your own."
      />

      <div className="rr-choice-grid flex-1">
        <button
          type="button"
          onClick={() => onChange("immediate")}
          aria-pressed={value === "immediate"}
          className={cn(
            OPTION_BASE,
            value === "immediate"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <SelectionTick active={value === "immediate"} />
          <div className={cn(
            "rr-choice-icon p-3 rounded-xl motion-safe:transition-colors",
            value === "immediate" ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-lg">Play today</p>
            <p className="text-sm text-muted-foreground mt-1">
              Bring your players, build the rotation, and get on court.
            </p>
            <p className="rr-choice-detail">Select this mode, then continue →</p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange("open_registration")}
          aria-pressed={value === "open_registration"}
          className={cn(
            OPTION_BASE,
            value === "open_registration"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <SelectionTick active={value === "open_registration"} />
          <div className={cn(
            "rr-choice-icon p-3 rounded-xl motion-safe:transition-colors",
            value === "open_registration" ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-lg">Plan ahead</p>
            <p className="text-sm text-muted-foreground mt-1">
              Pick a date and give your players time to sign up.
            </p>
            <p className="rr-choice-detail">Select this mode, then continue →</p>
          </div>
        </button>
      </div>
    </div>
  );
}
