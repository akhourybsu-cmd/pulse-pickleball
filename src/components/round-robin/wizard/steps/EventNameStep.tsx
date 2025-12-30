import { Input } from "@/components/ui/input";
import { generateDefaultEventName } from "../hooks/useWizardSteps";

interface EventNameStepProps {
  value: string;
  onChange: (value: string) => void;
}

export function EventNameStep({ value, onChange }: EventNameStepProps) {
  const defaultName = generateDefaultEventName();

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">Name your event</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Give your Round Robin a memorable name
      </p>

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
