import { Button } from "@/components/ui/button";
import { Calendar, Users } from "lucide-react";

interface TodayAtCourtBandProps {
  courtName: string;
  onJoinQueue: () => void;
  onViewEvents: () => void;
}

export function TodayAtCourtBand({ courtName, onJoinQueue, onViewEvents }: TodayAtCourtBandProps) {
  return (
    <div 
      className="rounded-lg border-l-4 shadow-sm p-4 sm:p-6"
      style={{
        borderLeftColor: '#A9DC3D',
        background: 'linear-gradient(90deg, hsl(var(--primary) / 0.05) 0%, hsl(var(--background)) 100%)',
      }}
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Left: Title and Summary */}
        <div className="flex-1 space-y-2">
          <h2 className="text-xl sm:text-2xl font-semibold text-[#0E4C58]">
            Today at {courtName}
          </h2>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">
              Check what's happening at {courtName} today.
            </p>
            <p className="text-sm text-muted-foreground">
              Courts: 4 • Typical skill range: 3.0–4.0
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-col sm:flex-row gap-3 lg:flex-col lg:items-end">
          <Button 
            onClick={onJoinQueue}
            className="gap-2 w-full sm:w-auto"
            style={{
              backgroundColor: '#A9DC3D',
              color: '#0E4C58',
            }}
          >
            <Users className="w-4 h-4" />
            Join Session Queue
          </Button>
          <Button
            onClick={onViewEvents}
            variant="ghost"
            className="gap-2 w-full sm:w-auto text-primary hover:underline underline-offset-4"
          >
            <Calendar className="w-4 h-4" />
            View Events
          </Button>
        </div>
      </div>
    </div>
  );
}
