import { Tag } from "lucide-react";
import { Input } from "@/components/ui/input";
import { generateDefaultEventName } from "../hooks/useWizardSteps";
import { StepHeader } from "../StepHeader";

interface EventNameStepProps {
  value: string;
  onChange: (value: string) => void;
}

export function EventNameStep({ value, onChange }: EventNameStepProps) {
  const defaultName = generateDefaultEventName();

  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={Tag}
        title="Name your event"
        description="Short and memorable — players see this everywhere."
      />

      <div className="flex-1">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={defaultName}
          className="text-lg h-14"
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground mt-2">
          Leave blank to use: "{defaultName}"
        </p>
      </div>
    </div>
  );
}
