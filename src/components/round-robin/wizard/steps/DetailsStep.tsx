import { FileText, MapPin, Globe, Lock, Check, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CityAutocomplete, VerifiedCity } from "@/components/match-wizard/CityAutocomplete";
import { generateDefaultEventName } from "../hooks/useWizardSteps";
import { cn } from "@/lib/utils";

interface DetailsStepProps {
  eventName: string;
  onEventNameChange: (v: string) => void;
  /** Free-text location name (e.g., "Memorial Park Court 2"). */
  locationLabel: string;
  onLocationLabelChange: (v: string) => void;
  /** Verified town/city from Google autocomplete (e.g., "Brooklyn, NY"). */
  cityLabel: string;
  cityPlaceId: string;
  onCityChange: (label: string, placeId: string) => void;
  notes: string;
  onNotesChange: (v: string) => void;
  eventMode: "immediate" | "open_registration";
  isInviteOnly: boolean;
  onIsInviteOnlyChange: (v: boolean) => void;
}

/**
 * Consolidated "Event Details" step. The legacy court dropdown was removed
 * because round robins now live anywhere, not just registered community
 * courts. Hosts type a free-form Location Name and pick a verified
 * Town/City from Google autocomplete — both render on the match card.
 */
export function DetailsStep({
  eventName,
  onEventNameChange,
  locationLabel,
  onLocationLabelChange,
  cityLabel,
  cityPlaceId,
  onCityChange,
  notes,
  onNotesChange,
  eventMode,
  isInviteOnly,
  onIsInviteOnlyChange,
}: DetailsStepProps) {
  const defaultName = generateDefaultEventName();

  const handleVerifiedCity = (city: VerifiedCity) => {
    const label = [city.city || city.name, city.state].filter(Boolean).join(", ");
    onCityChange(label, city.placeId);
  };

  const clearCity = () => onCityChange("", "");

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

        {/* Location Name (free text) */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Location name</label>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-muted flex-shrink-0">
              <MapPin className="h-4 w-4" />
            </div>
            <Input
              value={locationLabel}
              onChange={(e) => onLocationLabelChange(e.target.value)}
              placeholder="e.g., Memorial Park Court 2"
              className="flex-1 h-12"
              maxLength={80}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Shown on the match card so players know where to meet.
          </p>
        </div>

        {/* Verified Town / City */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Town or city</label>
          {cityLabel ? (
            <Card className="p-3 ring-2 ring-primary bg-primary/5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <div className="min-w-0">
                    <div className="font-medium truncate">{cityLabel}</div>
                    <div className="text-xs text-muted-foreground">Verified location</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={clearCity}
                  className="h-7 w-7 flex-shrink-0"
                  aria-label="Clear city"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          ) : (
            <CityAutocomplete onSelect={handleVerifiedCity} />
          )}
          <p className="text-xs text-muted-foreground">
            Pick from the verified list — also shown on the match card so
            spelling stays consistent across players.
          </p>
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

        {/* Who can join? — open-registration only */}
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
