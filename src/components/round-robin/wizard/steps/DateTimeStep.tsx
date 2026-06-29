import { useState } from "react";
import { Calendar, Clock, CalendarClock } from "lucide-react";
import { StepHeader } from "../StepHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, addDays, isAfter, isBefore, startOfToday, parse } from "date-fns";

interface DateTimeStepProps {
  eventMode: "immediate" | "open_registration";
  eventDate: string;
  onEventDateChange: (value: string) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
  registrationDeadline: string;
  onRegistrationDeadlineChange: (value: string) => void;
}

// Quick time presets
const TIME_PRESETS = [
  { label: "9 AM", value: "09:00" },
  { label: "10 AM", value: "10:00" },
  { label: "12 PM", value: "12:00" },
  { label: "2 PM", value: "14:00" },
  { label: "4 PM", value: "16:00" },
  { label: "6 PM", value: "18:00" },
  { label: "7 PM", value: "19:00" },
];

// Deadline presets relative to event date
const DEADLINE_PRESETS = [
  { label: "1 hour before", hoursBeforeEvent: 1 },
  { label: "2 hours before", hoursBeforeEvent: 2 },
  { label: "Day before", daysBefore: 1 },
  { label: "2 days before", daysBefore: 2 },
];

function formatTime12Hour(time24: string): string {
  if (!time24) return "";
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  const hour12 = hours % 12 || 12;
  return `${hour12}:${minutes.toString().padStart(2, "0")} ${period}`;
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
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const today = startOfToday();

  // Parse current event date
  const selectedDate = eventDate ? parse(eventDate, "yyyy-MM-dd'T'HH:mm", new Date()) : undefined;
  const selectedDateOnly = selectedDate || (eventDate ? new Date(eventDate) : undefined);

  // Handle date selection from calendar
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    
    // Preserve existing time or default to current time selection
    const timeToUse = startTime || "10:00";
    const [hours, minutes] = timeToUse.split(":").map(Number);
    date.setHours(hours, minutes, 0, 0);
    
    const dateTimeString = format(date, "yyyy-MM-dd'T'HH:mm");
    onEventDateChange(dateTimeString);
    setDatePickerOpen(false);
    
    // Auto-set a sensible registration deadline if not set
    if (!registrationDeadline) {
      const deadline = new Date(date);
      deadline.setHours(deadline.getHours() - 2); // 2 hours before by default
      onRegistrationDeadlineChange(format(deadline, "yyyy-MM-dd'T'HH:mm"));
    }
  };

  // Handle time preset selection
  const handleTimePreset = (timeValue: string) => {
    onStartTimeChange(timeValue);
    
    // If we have a date, update the full datetime
    if (eventDate) {
      const [hours, minutes] = timeValue.split(":").map(Number);
      const dateObj = new Date(eventDate);
      dateObj.setHours(hours, minutes, 0, 0);
      onEventDateChange(format(dateObj, "yyyy-MM-dd'T'HH:mm"));
    }
  };

  // Handle deadline preset selection
  const handleDeadlinePreset = (preset: typeof DEADLINE_PRESETS[0]) => {
    if (!eventDate) return;
    
    const eventDateTime = new Date(eventDate);
    const deadline = new Date(eventDateTime);
    
    if (preset.hoursBeforeEvent) {
      deadline.setHours(deadline.getHours() - preset.hoursBeforeEvent);
    } else if (preset.daysBefore) {
      deadline.setDate(deadline.getDate() - preset.daysBefore);
    }
    
    onRegistrationDeadlineChange(format(deadline, "yyyy-MM-dd'T'HH:mm"));
  };

  // Validate deadline is before event
  const isDeadlineValid = () => {
    if (!eventDate || !registrationDeadline) return true;
    return isBefore(new Date(registrationDeadline), new Date(eventDate));
  };

  // For immediate mode - just show start time
  if (eventMode === "immediate") {
    return (
      <div className="flex flex-col h-full">
        <StepHeader
          icon={Clock}
          title="What time does it start?"
          description={`Today · ${format(new Date(), "EEEE, MMMM d")}`}
        />

        <div className="flex-1 space-y-4">
          {/* Quick time presets */}
          <div className="grid grid-cols-4 gap-2">
            {TIME_PRESETS.map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant={startTime === preset.value ? "default" : "outline"}
                size="sm"
                onClick={() => onStartTimeChange(preset.value)}
                className="text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Custom time input */}
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-muted">
              <Clock className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <Label className="text-xs text-muted-foreground mb-1 block">
                Or pick a custom time
              </Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => onStartTimeChange(e.target.value)}
                className="h-12 text-lg"
              />
            </div>
          </div>

          {startTime && (
            <p className="text-center text-sm text-muted-foreground">
              Starting at <span className="font-medium text-foreground">{formatTime12Hour(startTime)}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // For open_registration mode - show full date/time picker
  return (
    <div className="flex flex-col h-full">
      <StepHeader
        icon={CalendarClock}
        title="When is your event?"
        description="Date, start time, and registration deadline."
      />

      <div className="flex-1 space-y-5">
        {/* Event Date Picker */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Event Date
          </Label>
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full h-12 justify-start text-left font-normal",
                  !selectedDateOnly && "text-muted-foreground"
                )}
              >
                <CalendarClock className="mr-2 h-4 w-4" />
                {selectedDateOnly ? format(selectedDateOnly, "EEEE, MMMM d, yyyy") : "Select a date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 z-50" align="start">
              <CalendarPicker
                mode="single"
                selected={selectedDateOnly}
                onSelect={handleDateSelect}
                disabled={(date) => isBefore(date, today)}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Start Time */}
        <div className="space-y-2">
          <Label className="text-sm font-medium flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Start Time
          </Label>
          
          {/* Time presets */}
          <div className="grid grid-cols-4 gap-2">
            {TIME_PRESETS.slice(0, 4).map((preset) => (
              <Button
                key={preset.value}
                type="button"
                variant={startTime === preset.value ? "default" : "outline"}
                size="sm"
                onClick={() => handleTimePreset(preset.value)}
                className="text-xs"
              >
                {preset.label}
              </Button>
            ))}
          </div>
          
          <Input
            type="time"
            value={startTime}
            onChange={(e) => handleTimePreset(e.target.value)}
            className="h-11"
          />
        </div>

        {/* Registration Deadline */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Registration Deadline</Label>
          
          {/* Deadline presets - only show if event date is set */}
          {eventDate && (
            <div className="grid grid-cols-2 gap-2">
              {DEADLINE_PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeadlinePreset(preset)}
                  className="text-xs"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}
          
          <Input
            type="datetime-local"
            value={registrationDeadline}
            onChange={(e) => onRegistrationDeadlineChange(e.target.value)}
            max={eventDate}
            className={cn("h-11", !isDeadlineValid() && "border-destructive")}
          />
          
          {!isDeadlineValid() && (
            <p className="text-xs text-destructive">
              Deadline must be before the event starts
            </p>
          )}
          
          <p className="text-xs text-muted-foreground">
            Players can register until this time
          </p>
        </div>

        {/* Summary */}
        {eventDate && startTime && registrationDeadline && isDeadlineValid() && (
          <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1">
            <p>
              <span className="text-muted-foreground">Event:</span>{" "}
              <span className="font-medium">
                {format(new Date(eventDate), "EEE, MMM d")} at {formatTime12Hour(startTime)}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">Registration closes:</span>{" "}
              <span className="font-medium">
                {format(new Date(registrationDeadline), "EEE, MMM d 'at' h:mm a")}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
