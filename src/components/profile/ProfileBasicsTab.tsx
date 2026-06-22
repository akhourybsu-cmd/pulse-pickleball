import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, UserCog } from "lucide-react";

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
}

export function ProfileIdentitySection({
  formData,
  onFormChange,
  onFileUpload,
  onRemoveAvatar,
  uploading,
}: IdentitySectionProps) {
  return (
    <div className="space-y-4">
      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0">
          {formData.avatar_url ? (
            <div className="relative">
              <img
                src={formData.avatar_url}
                alt="Profile"
                className="w-20 h-20 rounded-full object-cover border-2 border-primary"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                onClick={onRemoveAvatar}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center border-2 border-dashed border-primary/30">
              <UserCog className="w-10 h-10 text-primary/50" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={() => document.getElementById('avatar-upload')?.click()}
          >
            <Upload className="w-4 h-4 mr-2" />
            {uploading ? "Uploading..." : "Upload photo"}
          </Button>
          <Input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFileUpload}
            disabled={uploading}
          />
          <p className="text-xs text-muted-foreground mt-2">JPG, PNG, or WebP. Max 5MB.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="first_name">First Name *</Label>
          <Input
            id="first_name"
            value={formData.first_name || ""}
            onChange={(e) => onFormChange({ first_name: e.target.value })}
            placeholder="John"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">Last Name *</Label>
          <Input
            id="last_name"
            value={formData.last_name || ""}
            onChange={(e) => onFormChange({ last_name: e.target.value })}
            placeholder="Doe"
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="display_name">Display Name</Label>
        <Input
          id="display_name"
          value={formData.display_name || ""}
          onChange={(e) => onFormChange({ display_name: e.target.value })}
          placeholder="Alex K."
        />
        <p className="text-xs text-muted-foreground">How you appear on leaderboards</p>
      </div>
    </div>
  );
}

interface LocationSectionProps {
  formData: LocationFields;
  onFormChange: (updates: Partial<LocationFields>) => void;
}

export function ProfileLocationSection({ formData, onFormChange }: LocationSectionProps) {
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
                <SelectItem key={st} value={st}>{st}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Helps players nearby find you</p>
    </div>
  );
}
