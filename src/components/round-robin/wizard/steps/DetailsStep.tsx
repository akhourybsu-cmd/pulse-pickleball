import { useState, useEffect } from "react";
import { FileText, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { generateDefaultEventName } from "../hooks/useWizardSteps";

interface Court {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface DetailsStepProps {
  eventName: string;
  onEventNameChange: (v: string) => void;
  locationId: string;
  onLocationIdChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
}

/**
 * Consolidated "Event Details" step — combines the previous Name, Location,
 * and Notes screens into one form. All three fields are optional (Name
 * auto-fills with a generated default, Location and Notes can stay blank).
 *
 * Reduces the wizard from 11 steps to a more reasonable count without
 * forcing the player through three minimally-different screens for what's
 * conceptually one form.
 */
export function DetailsStep({
  eventName,
  onEventNameChange,
  locationId,
  onLocationIdChange,
  notes,
  onNotesChange,
}: DetailsStepProps) {
  const [courts, setCourts] = useState<Court[]>([]);
  const defaultName = generateDefaultEventName();

  useEffect(() => {
    const fetchCourts = async () => {
      const { data } = await supabase
        .from("courts")
        .select("id, name, city, state")
        .order("name");
      if (data) setCourts(data);
    };
    fetchCourts();
  }, []);

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-xl font-semibold mb-2">Event details</h2>
      <p className="text-muted-foreground text-sm mb-6">
        A few details so players know what they're joining. All optional.
      </p>

      <div className="flex-1 space-y-5">
        {/* Event name */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Event name</label>
          <Input
            value={eventName}
            onChange={(e) => onEventNameChange(e.target.value)}
            placeholder={defaultName}
            className="text-base h-12"
            maxLength={100}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to use: <span className="font-medium">{defaultName}</span>
          </p>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Location</label>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-muted flex-shrink-0">
              <MapPin className="h-4 w-4" />
            </div>
            <Select value={locationId} onValueChange={onLocationIdChange}>
              <SelectTrigger className="flex-1 h-12">
                <SelectValue placeholder="Select a court (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific location</SelectItem>
                {courts.map((court) => (
                  <SelectItem key={court.id} value={court.id}>
                    {court.name} - {court.city}, {court.state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Notes for players</label>
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-lg bg-muted flex-shrink-0">
              <FileText className="h-4 w-4" />
            </div>
            <Textarea
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="e.g., Bring water bottles, parking info, skill level..."
              className="flex-1 min-h-[96px] resize-none"
              maxLength={500}
            />
          </div>
          <p className="text-xs text-muted-foreground text-right">
            {notes.length}/500
          </p>
        </div>
      </div>
    </div>
  );
}
