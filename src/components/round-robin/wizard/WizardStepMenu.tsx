import { useState } from "react";
import { Check, ChevronRight, ListOrdered } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { WizardStep } from "./hooks/useWizardSteps";

const descriptions: Record<string, string> = {
  mode: "Today or a future date", format: "Choose your player mix", details: "Name, location & notes",
  players: "Build your guest list", schedule: "Courts & game rotations", datetime: "Set the starting time",
  ratings: "Competition & guests", sharing: "Bring your community", review: "The finishing touches",
};

interface Props {
  steps: WizardStep[];
  current: number;
  furthest: number;
  isStepValid: (id: string) => boolean;
  onSelect: (index: number) => void;
  disabled: boolean;
}

export function WizardStepMenu({ steps, current, furthest, isStepValid, onSelect, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const menu = (mobile = false) => (
    <nav aria-label={mobile ? "All creation steps" : "Creation steps"}>
      <ol className="space-y-1">
        {steps.map((step, index) => {
          const active = current === index;
          const complete = index < furthest && isStepValid(step.id);
          return <li key={step.id}>
            <button type="button" disabled={disabled || index > furthest}
              aria-current={active ? "step" : undefined}
              aria-label={`${index + 1}. ${step.label}${complete ? ", complete" : ""}${index > furthest ? ", complete earlier steps first" : ""}`}
              onClick={() => { onSelect(index); setOpen(false); }}
              className={cn("rr-step-link", active && "is-current")}>
              <span className={cn("rr-step-number", complete && !active && "is-complete")}>
                {complete && !active ? <Check className="h-4 w-4" /> : String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-semibold">{step.label}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">{descriptions[step.id]}</span>
              </span>
              {active && <ChevronRight className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          </li>;
        })}
      </ol>
    </nav>
  );
  return <>
    <aside className="rr-step-sidebar">
      <p className="rr-eyebrow mb-4 px-3">Your event, step by step</p>
      {menu()}
      <p className="mt-5 px-3 text-xs leading-relaxed text-muted-foreground">Make it yours. You can revisit any completed step before creating your event.</p>
    </aside>
    <div className="rr-mobile-steps">
      <div className="flex items-center justify-between gap-2">
        <div aria-live="polite" className="min-w-0 text-sm"><span className="font-semibold">{steps[current].label}</span><span className="ml-2 text-xs text-muted-foreground">{current + 1} of {steps.length}</span></div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild><Button variant="ghost" disabled={disabled} className="h-11 gap-2 px-2 text-xs"><ListOrdered />All steps</Button></SheetTrigger>
          <SheetContent side="bottom" className="rr-steps-sheet max-h-[90dvh] overflow-y-auto rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
            <SheetTitle>Your event journey</SheetTitle>
            <SheetDescription className="mb-5 mt-1">Jump back to refine a completed step.</SheetDescription>
            {menu(true)}
          </SheetContent>
        </Sheet>
      </div>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {steps.map((s, i) => <span key={s.id} className={cn("h-1 flex-1 rounded-full transition-colors", i <= current ? "bg-primary" : "bg-border/60")} />)}
      </div>
    </div>
  </>;
}
