import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OnboardingLayout } from "./OnboardingLayout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { User, Upload, MapPin, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

import { US_STATE_CODES } from "@/lib/us-states";

const US_STATES = US_STATE_CODES;

interface OnboardingProfileSetupProps {
  userId: string;
  onComplete: () => void;
  onSkip: () => void;
}

export const OnboardingProfileSetup = ({ 
  userId, 
  onComplete, 
  onSkip 
}: OnboardingProfileSetupProps) => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState({
    display_name: "",
    avatar_url: "",
    town: "",
    state: "",
    initial_self_rating: null as number | null,
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5242880) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Photo uploaded!");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.display_name.trim()) {
      toast.error("Please enter a display name");
      return;
    }

    setSaving(true);
    try {
      const updateData: Record<string, string | number> = {
        display_name: formData.display_name.trim(),
      };

      if (formData.avatar_url) {
        updateData.avatar_url = formData.avatar_url;
      }
      if (formData.town.trim()) {
        updateData.town = formData.town.trim();
      }
      if (formData.state) {
        updateData.state = formData.state;
      }
      // Self-assessment: seed both the one-shot column (used as the
      // starting rating in recalculate_all_ratings) and current_rating
      // so the player sees the chosen value immediately instead of
      // waiting for their first match to trigger a recalc.
      if (formData.initial_self_rating != null) {
        updateData.initial_self_rating = formData.initial_self_rating;
        updateData.current_rating = formData.initial_self_rating;
        updateData.week_start_rating = formData.initial_self_rating;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId);

      if (error) throw error;

      toast.success("Profile saved!");
      onComplete();
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingLayout currentStep={0}>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <User className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            Set Up Your Profile
          </h1>
          <p className="text-muted-foreground text-sm">
            This helps other players find and recognize you.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-5">
          {/* Display Name */}
          <div className="space-y-2">
            <Label htmlFor="display_name" className="text-sm font-medium">
              Display Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="display_name"
              placeholder="What should we call you?"
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              className="h-12"
            />
          </div>

          {/* Profile Photo */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Profile Photo <span className="text-muted-foreground">(optional)</span>
            </Label>
            <div className="flex items-center gap-4">
              {formData.avatar_url ? (
                <img
                  src={formData.avatar_url}
                  alt="Profile"
                  className="w-16 h-16 rounded-full object-cover border-2 border-primary"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-muted-foreground/30">
                  <User className="w-8 h-8 text-muted-foreground/50" />
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                {uploading ? "Uploading..." : formData.avatar_url ? "Change" : "Add Photo"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" />
              Location <span className="text-muted-foreground">(optional)</span>
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="City"
                value={formData.town}
                onChange={(e) => setFormData(prev => ({ ...prev, town: e.target.value }))}
                className="h-11"
              />
              <Select
                value={formData.state}
                onValueChange={(value) => setFormData(prev => ({ ...prev, state: value }))}
              >
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="State" />
                </SelectTrigger>
                <SelectContent>
                  {US_STATES.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Self-assessment */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" />
              Your skill level <span className="text-muted-foreground">(optional)</span>
            </Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Helps us start you at the right rating. You can't change this later.
            </p>
            <div className="grid grid-cols-1 gap-2">
              {[
                { value: 2.5, label: "Just starting", hint: "New to the sport" },
                { value: 3.0, label: "Recreational", hint: "Play for fun, still learning" },
                { value: 3.5, label: "Intermediate", hint: "Comfortable with basic strategy" },
                { value: 4.0, label: "Competitive", hint: "Play in leagues or tournaments" },
                { value: 4.5, label: "Advanced", hint: "Consistent performer at high levels" },
              ].map((opt) => {
                const selected = formData.initial_self_rating === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        initial_self_rating: selected ? null : opt.value,
                      }))
                    }
                    className={cn(
                      "w-full text-left rounded-lg border px-3.5 py-2.5 transition-colors",
                      selected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-border/70 hover:bg-muted/40",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{opt.label}</span>
                      <span className="text-xs font-mono text-muted-foreground">
                        {opt.value.toFixed(1)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button 
            onClick={handleSave}
            disabled={saving || !formData.display_name.trim()}
            className="w-full h-12 text-base font-semibold"
          >
            {saving ? "Saving..." : "Continue"}
          </Button>
          <button
            onClick={onSkip}
            className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            I'll do this later
          </button>
        </div>
      </div>
    </OnboardingLayout>
  );
};
