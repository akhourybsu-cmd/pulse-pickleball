import { Building, Crown, MapPin, Trophy, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface VenueTypeStepProps {
  value: string;
  onChange: (value: string) => void;
}

const VENUE_TYPES = [
  { id: "recreation_center", label: "Recreation Center / YMCA", icon: Building },
  { id: "private_club", label: "Private Club", icon: Crown },
  { id: "public_courts", label: "Public Courts / Municipality", icon: MapPin },
  { id: "tournament_organizer", label: "Tournament Organizer", icon: Trophy },
  { id: "other", label: "Other", icon: MoreHorizontal },
];

export function VenueTypeStep({ value, onChange }: VenueTypeStepProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-2">What best describes your venue or organization?</h2>
        <p className="text-muted-foreground">Select the option that fits best</p>
      </div>

      <div className="flex-1 space-y-3">
        {VENUE_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = value === type.id;

          return (
            <button
              key={type.id}
              onClick={() => onChange(type.id)}
              className={cn(
                "flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all w-full",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div
                className={cn(
                  "p-3 rounded-lg",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="font-medium">{type.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
