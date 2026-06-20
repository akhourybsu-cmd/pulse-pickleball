import { useState, useEffect } from "react";
import { FileText, MapPin, Globe, Lock } from "lucide-react";
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
import { cn } from "@/lib/utils";

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
  locationLabel: string;
  onLocationLabelChange: (v: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  /** Current event mode — controls whether the "Who can join?" picker
   *  appears. Hidden for immediate-mode events (the host adds players
   *  directly so visibility doesn't apply). */
  eventMode: "immediate" | "open_registration";
  isInviteOnly: boolean;
  onIsInviteOnlyChange: (v: boolean) => void;
}

/**
 * Consolidated "Event Details" step — combines the previous Name, Location,
 * Notes screens into one form, plus the new "Who can join?" visibility
 * picker for open-registration events.
 *
 * All four sections are optional. Name auto-fills with a generated default,
 * location and notes can stay blank, and visibility defaults to "Open".
 */
export function DetailsStep({
  eventName,
  onEventNameChange,
  locationId,
  onLocationIdChange,
  locationLabel,
  onLocationLabelChange,
  notes,
  onNotesChange,
  eventMode,
  isInviteOnly,
  onIsInviteOnlyChange,
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
          {/* Free-text town/city — what actually shows on the match card.
              Stored separately from the court selection so hosts can name
              a town even when no community court applies. */}
          <Input
            value={locationLabel}
            onChange={(e) => onLocationLabelChange(e.target.value)}
            placeholder="Town or city (shown on the match card)"
            className="h-11"
            maxLength={80}
          />
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

        {/* Who can join? — only shown for open-registration events.
            Immediate-mode events have a fixed roster, so visibility doesn't
            apply. */}
        {eventMode === "open_registration" && (
          <div className="space-y-2">
            <label className="text-sm font-medium">Who can join?</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onIsInviteOnlyChange(false)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all",
                  !isInviteOnly
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-border/80 hover:bg-muted/30",
                )}
              >
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    !isInviteOnly ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Globe className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">Open to everyone</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    Discoverable in the player Available feed.
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onIsInviteOnlyChange(true)}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-all",
                  isInviteOnly
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-border/80 hover:bg-muted/30",
                )}
              >
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0",
                    isInviteOnly ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Lock className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm">Invite only</div>
                  <div className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    Hidden from discovery. Players join with an invite code.
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
