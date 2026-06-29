import { CalendarClock, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { StepHeader } from "../StepHeader";

interface EventModeStepProps {
  value: "immediate" | "open_registration";
  onChange: (value: "immediate" | "open_registration") => void;
}

export function EventModeStep({ value, onChange }: EventModeStepProps) {
  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={Zap}
        title="How are you running this?"
        description="Pick a mode — you can change the details next."
      />

      <div className="flex-1 flex flex-col gap-4">
        <button
          type="button"
          onClick={() => onChange("immediate")}
          className={cn(
            "flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all",
            value === "immediate"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <div className={cn(
            "p-3 rounded-lg",
            value === "immediate" ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Immediate Event</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add players now and start playing today
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChange("open_registration")}
          className={cn(
            "flex items-start gap-4 p-5 rounded-xl border-2 text-left transition-all",
            value === "open_registration"
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <div className={cn(
            "p-3 rounded-lg",
            value === "open_registration" ? "bg-primary text-primary-foreground" : "bg-muted"
          )}>
            <CalendarClock className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Future Event with Registration</p>
            <p className="text-sm text-muted-foreground mt-1">
              Schedule the event and let players sign up
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
