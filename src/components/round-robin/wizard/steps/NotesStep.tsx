import { StickyNote } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { StepHeader } from "../StepHeader";

interface NotesStepProps {
  value: string;
  onChange: (value: string) => void;
}

export function NotesStep({ value, onChange }: NotesStepProps) {
  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={StickyNote}
        title="Anything players should know?"
        description="What to bring, skill notes, format quirks — optional."
      />

      <div className="flex-1">
        <div className="flex items-start gap-3">
          <div className="p-3 rounded-lg bg-muted">
            <FileText className="h-5 w-5" />
          </div>
          <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="e.g., Bring water bottles, parking info, skill level expectations..."
            className="flex-1 min-h-[120px] resize-none"
            maxLength={500}
          />
        </div>
        <p className="text-xs text-muted-foreground text-right mt-2">
          {value.length}/500
        </p>
      </div>
    </div>
  );
}
