import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, X, UserCog, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

import { US_STATE_CODES } from "@/lib/us-states";

const US_STATES = US_STATE_CODES;

interface ProfileBasicsTabProps {
  formData: {
    first_name: string | null;
    last_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    phonetic_name: string | null;
    town: string | null;
    state: string | null;
  };
  onFormChange: (updates: Partial<ProfileBasicsTabProps['formData']>) => void;
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveAvatar: () => void;
  uploading: boolean;
  highlightLocation?: boolean;
  locationRef?: React.RefObject<HTMLDivElement>;
}

export function ProfileBasicsTab({
  formData,
  onFormChange,
  onFileUpload,
  onRemoveAvatar,
  uploading,
  highlightLocation = false,
  locationRef,
}: ProfileBasicsTabProps) {
  return (
    <div className="space-y-6">
      {/* Profile Picture */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Picture</CardTitle>
          <CardDescription>Upload a photo to personalize your profile</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-6">
            <div className="flex-shrink-0">
              {formData.avatar_url ? (
                <div className="relative">
                  <img
                    src={formData.avatar_url}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-2 border-primary"
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
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border-2 border-dashed border-primary/30">
                  <UserCog className="w-12 h-12 text-primary/50" />
                </div>
              )}
            </div>
            <div className="flex-1">
              <Label htmlFor="avatar-upload" className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={uploading}
                    onClick={() => document.getElementById('avatar-upload')?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploading ? "Uploading..." : "Upload Photo"}
                  </Button>
                </div>
              </Label>
              <Input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFileUpload}
                disabled={uploading}
              />
              <p className="text-xs text-muted-foreground mt-2">
                JPG, PNG, or WebP. Max 5MB.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Identity */}
      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>How you appear to other players</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                value={formData.first_name || ""}
                onChange={(e) => onFormChange({ first_name: e.target.value })}
                placeholder="John"
                required
              />
              {!formData.first_name?.trim() && (
                <p className="text-xs text-destructive">First name is required</p>
              )}
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
              {!formData.last_name?.trim() && (
                <p className="text-xs text-destructive">Last name is required</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="display_name">Display Name</Label>
            <Input
              id="display_name"
              value={formData.display_name || ""}
              onChange={(e) => onFormChange({ display_name: e.target.value })}
              placeholder="Alex K."
              maxLength={50}
            />
            <p className="text-xs text-muted-foreground">
              How you want to be shown on leaderboards.{' '}
              {!formData.display_name?.trim() && (
                <span className="text-foreground/80">
                  Leave blank to use your first name ({formData.first_name || '—'}).
                </span>
              )}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phonetic_name">Phonetic Name (optional)</Label>
            <Input
              id="phonetic_name"
              value={formData.phonetic_name || ""}
              onChange={(e) => onFormChange({ phonetic_name: e.target.value })}
              placeholder="AL-ex"
            />
            <p className="text-xs text-muted-foreground">Helps with pronunciation</p>
          </div>
        </CardContent>
      </Card>

      {/* Location */}
      <Card 
        ref={locationRef as React.RefObject<HTMLDivElement>}
        className={cn(
          "transition-all duration-500",
          highlightLocation && "ring-2 ring-primary ring-offset-2"
        )}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Location
          </CardTitle>
          <CardDescription>Where you play most often</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
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
          <p className="text-xs text-muted-foreground">Your location is shown on your profile and helps other players find you</p>
        </CardContent>
      </Card>
    </div>
  );
}
