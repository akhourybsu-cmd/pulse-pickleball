import { Calendar, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface DateTimeStepProps {
  eventMode: "immediate" | "open_registration";
  eventDate: string;
  onEventDateChange: (value: string) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  registrationDeadline: string;
  onRegistrationDeadlineChange: (value: string) => void;
}

export function DateTimeStep({
  eventMode,
  eventDate,
  onEventDateChange,
  startTime,
  onStartTimeChange,
  registrationDeadline,
  onRegistrationDeadlineChange,
}: DateTimeStepProps) {
  const today = new Date().toISOString().split("T")[0];
  const minDateTime = new Date().toISOString().slice(0, 16);

  if (eventMode === "immediate") {
    return (
      <div className="flex flex-col h-full">
        <h2 className="text-xl font-semibold mb-2">What time does it start?</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Today • {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>

        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <Clock className="h-5 w-5" />
            </div>
            <Input
              type="time"
              value={startTime}
              onChange={(e) => onStartTimeChange(e.target.value)}
              className="flex-1 h-14 text-lg"
            />
          </div>
        </div>
      </div>
    );
  }

  // Future event mode
  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">When is your event?</h2>
      <p className="text-muted-foreground text-sm mb-6">
        Set the event date and registration deadline
      </p>

      <div className="flex-1 space-y-5">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Event Date & Time</Label>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <Calendar className="h-5 w-5" />
            </div>
            <Input
              type="datetime-local"
              value={eventDate}
              onChange={(e) => onEventDateChange(e.target.value)}
              min={minDateTime}
              className="flex-1 h-14"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Registration Deadline</Label>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <Clock className="h-5 w-5" />
            </div>
            <Input
              type="datetime-local"
              value={registrationDeadline}
              onChange={(e) => onRegistrationDeadlineChange(e.target.value)}
              max={eventDate}
              className="flex-1 h-14"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Players can register until this time
          </p>
        </div>
      </div>
    </div>
  );
}
