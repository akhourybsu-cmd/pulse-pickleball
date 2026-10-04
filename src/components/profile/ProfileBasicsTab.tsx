import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, X, UserCog, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  IMAGE_FILE_ACCEPT,
  type ImageFit,
} from "@/lib/images/prepareImageUpload";

import { US_STATE_CODES } from "@/lib/us-states";

const US_STATES = US_STATE_CODES;

interface IdentityFields {
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface LocationFields {
  town: string | null;
  state: string | null;
}

interface IdentitySectionProps {
  formData: IdentityFields;
  onFormChange: (updates: Partial<IdentityFields>) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAvatar: () => void;
  uploading: boolean;
  avatarFit: ImageFit;
  onAvatarFitChange: (fit: ImageFit) => void;
  /** When true, first/last name are frozen and rendered read-only. */
  nameLocked?: boolean;
}

export function ProfileIdentitySection({
  formData,
  onFormChange,
  onFileUpload,
  onRemoveAvatar,
  uploading,
  avatarFit,
  onAvatarFitChange,
  nameLocked = false,
}: IdentitySectionProps) {
  return (
    <div className="space-y-4">
      {/* Avatar */}
      <div className="grid grid-cols-1 items-center gap-4 rounded-xl border border-border/40 bg-muted/20 p-4 min-[375px]:grid-cols-[auto_minmax(0,1fr)]">
        <div className="w-20 shrink-0 sm:row-span-3">
          {formData.avatar_url ? (
            <div className="relative">
              <img
                src={formData.avatar_url}
                alt="Profile"
                className="h-20 w-20 rounded-2xl border-2 border-card object-cover shadow-sm ring-1 ring-border/60"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-8 w-8 rounded-full"
                aria-label="Remove profile photo"
                onClick={onRemoveAvatar}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10">
              <UserCog className="h-8 w-8 text-foreground/60" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-auto min-h-10 max-w-full whitespace-normal rounded-xl text-left"
            disabled={uploading}
            onClick={() => document.getElementById("avatar-upload")?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Uploading..." : "Upload photo"}
          </Button>
          <Input
            id="avatar-upload"
            type="file"
            accept={IMAGE_FILE_ACCEPT}
            className="hidden"
            onChange={onFileUpload}
            disabled={uploading}
          />
        </div>
        <div
          className="inline-flex max-w-full flex-wrap gap-1 justify-self-start rounded-lg border border-border/60 bg-background p-1 min-[375px]:col-span-2 sm:col-span-1 sm:col-start-2"
          role="group"
          aria-label="Profile photo fit"
        >
          {(
            [
              ["contain", "Show full photo"],
              ["cover", "Fill frame"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => onAvatarFitChange(value)}
              aria-pressed={avatarFit === value}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                avatarFit === value
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="-mt-2 text-xs leading-relaxed text-muted-foreground min-[375px]:col-span-2 sm:col-span-1 sm:col-start-2">
          JPG, PNG, or WebP. Up to 12MB; optimized automatically.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name" className="flex items-center gap-1.5">
            First Name *
            {nameLocked && (
              <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
            )}
          </Label>
          <Input
            id="first_name"
            value={formData.first_name || ""}
            onChange={(e) => onFormChange({ first_name: e.target.value })}
            placeholder="John"
            required
            readOnly={nameLocked}
            disabled={nameLocked}
            aria-describedby={nameLocked ? "name-lock-note" : undefined}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name" className="flex items-center gap-1.5">
            Last Name *
            {nameLocked && (
              <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
            )}
          </Label>
          <Input
            id="last_name"
            value={formData.last_name || ""}
            onChange={(e) => onFormChange({ last_name: e.target.value })}
            placeholder="Doe"
            required
            readOnly={nameLocked}
            disabled={nameLocked}
            aria-describedby={nameLocked ? "name-lock-note" : undefined}
          />
        </div>
      </div>

      {nameLocked && (
        <p
          id="name-lock-note"
          className="flex items-start gap-1.5 text-xs text-muted-foreground -mt-1"
        >
          <ShieldCheck
            className="h-3.5 w-3.5 mt-px shrink-0 text-primary/70"
            aria-hidden
          />
          <span>
            Your name is locked in. To correct a typo or record a legal name
            change, contact an organizer.
          </span>
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="display_name">Display Name</Label>
        <Input
          id="display_name"
          value={formData.display_name || ""}
          onChange={(e) => onFormChange({ display_name: e.target.value })}
          placeholder="Alex K."
        />
        <p className="text-xs text-muted-foreground">
          How you appear on leaderboards
        </p>
      </div>
    </div>
  );
}

interface LocationSectionProps {
  formData: LocationFields;
  onFormChange: (updates: Partial<LocationFields>) => void;
}

export function ProfileLocationSection({
  formData,
  onFormChange,
}: LocationSectionProps) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="town">City</Label>
          <Input
            id="town"
            value={formData.town || ""}
            onChange={(e) => onFormChange({ town: e.target.value })}
            placeholder="New York"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Select
            value={formData.state || ""}
            onValueChange={(value) => onFormChange({ state: value })}
          >
            <SelectTrigger id="state">
              <SelectValue placeholder="Select state..." />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((st) => (
                <SelectItem key={st} value={st}>
                  {st}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Helps players nearby find you
      </p>
    </div>
  );
}
