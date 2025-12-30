import { FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

interface NotesStepProps {
  value: string;
  onChange: (value: string) => void;
}

export function NotesStep({ value, onChange }: NotesStepProps) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">Anything players should know?</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Add additional details or instructions (optional)
      </p>

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
