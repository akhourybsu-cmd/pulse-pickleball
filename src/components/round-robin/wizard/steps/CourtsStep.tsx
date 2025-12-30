import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CourtsStepProps {
  value: number;
  onChange: (value: number) => void;
}

export function CourtsStep({ value, onChange }: CourtsStepProps) {
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">How many courts available?</h2>
      <p className="text-muted-foreground text-sm mb-6">
        More courts means more simultaneous games
      </p>

      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="flex items-center gap-6">
          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={() => onChange(Math.max(1, value - 1))}
            disabled={value <= 1}
          >
            <Minus className="h-6 w-6" />
          </Button>
          <span className="text-5xl font-bold tabular-nums w-20 text-center">
            {value}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-14 w-14 rounded-full"
            onClick={() => onChange(Math.min(20, value + 1))}
            disabled={value >= 20}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </div>
        <p className="text-muted-foreground text-sm mt-4">
          {value === 1 ? "Court" : "Courts"}
        </p>
      </div>
    </div>
  );
}
