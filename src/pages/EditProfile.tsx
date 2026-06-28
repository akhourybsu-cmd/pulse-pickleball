import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { UserCog, User, MapPin, Trophy, Gamepad2, Bell, KeyRound, ChevronRight, Loader2 } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PlayerPageHeader } from "@/components/layout/PlayerPageHeader";

import {
  ProfileIdentitySection,
  ProfileLocationSection,
} from "@/components/profile/ProfileBasicsTab";
import { TournamentInfoTab } from "@/components/profile/TournamentInfoTab";
import { PlayStyleTab } from "@/components/profile/PlayStyleTab";
import { TournamentReadinessCard } from "@/components/profile/TournamentReadinessCard";

import { calculateProfileCompleteness } from "@/lib/profileCompleteness";


interface ProfileData {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  town: string | null;
  state: string | null;
  
  handedness: string | null;
  play_side: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  skill_level_self: string | null;
}

type SectionKey = "identity" | "location" | "tournament" | "playstyle";

const focusToSection = (focus: string | null): SectionKey | null => {
  if (focus === "tournament") return "tournament";
  if (focus === "playstyle") return "playstyle";
  if (focus === "location") return "location";
  if (focus === "basics") return "identity";
  return null;
};

const EditProfile = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const returnUrl = searchParams.get("return");
  const focusSection = focusToSection(searchParams.get("focus"));

  const [openSections, setOpenSections] = useState<string[]>(
    focusSection ? [focusSection] : ["identity"]
  );

  const [formData, setFormData] = useState<ProfileData>({
    display_name: null,
    first_name: null,
    last_name: null,
    avatar_url: null,
    town: null,
    state: null,
    
    handedness: null,
    play_side: null,
    phone_number: null,
    date_of_birth: null,
    gender: null,
    skill_level_self: null,
  });

  const completeness = useMemo(() => calculateProfileCompleteness(formData), [formData]);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        navigate("/auth");
        return;
      }

      setUser(user);

      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        toast.error("Failed to load profile");
        return;
      }

      setFormData({
        display_name: profileData.display_name,
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        avatar_url: profileData.avatar_url,
        town: profileData.town,
        state: profileData.state,
        
        handedness: profileData.handedness,
        play_side: profileData.play_side,
        phone_number: profileData.phone_number,
        date_of_birth: profileData.date_of_birth,
        gender: profileData.gender,
        skill_level_self: profileData.skill_level_self,
      });

      setLoading(false);
    };

    fetchData();
  }, [navigate]);

  const handleFormChange = (updates: Partial<ProfileData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 5242880) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      if (formData.avatar_url) {
        const oldPath = formData.avatar_url.split("/").pop();
        if (oldPath) {
          await supabase.storage.from("avatars").remove([`${user.id}/${oldPath}`]);
        }
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setFormData((prev) => ({ ...prev, avatar_url: publicUrl }));

      // Persist avatar immediately
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      toast.success("Profile picture updated");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload profile picture");
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!user?.id || !formData.avatar_url) return;
    try {
      const oldPath = formData.avatar_url.split("/").pop();
      if (oldPath) {
        await supabase.storage.from("avatars").remove([`${user.id}/${oldPath}`]);
      }
      setFormData((prev) => ({ ...prev, avatar_url: null }));
      await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
      toast.success("Profile picture removed");
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error("Failed to remove profile picture");
    }
  };

  const handleResetPassword = async () => {
    if (!user?.email) return;
    setResettingPassword(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      toast.success("Password reset email sent! Check your inbox.");
    } catch (error) {
      console.error("Error sending password reset:", error);
      toast.error("Failed to send password reset email");
    } finally {
      setResettingPassword(false);
    }
  };

  const saveSection = async (section: SectionKey, payload: Partial<ProfileData>) => {
    if (!user?.id) return;

    if (section === "identity") {
      if (!payload.first_name?.toString().trim() || !payload.last_name?.toString().trim()) {
        toast.error("First and last name are required");
        return;
      }
    }

    setSavingSection(section);
    try {
      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;
      toast.success("Saved");
    } catch (error) {
      console.error("Error saving section:", error);
      toast.error("Failed to save");
    } finally {
      setSavingSection(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  const SectionSaveButton = ({
    section,
    onClick,
  }: {
    section: SectionKey;
    onClick: () => void;
  }) => (
    <Button
      size="sm"
      onClick={onClick}
      disabled={savingSection === section}
      className="w-full sm:w-auto"
    >
      {savingSection === section ? (
        <>
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          Saving...
        </>
      ) : (
        "Save"
      )}
    </Button>
  );

  const SectionHeader = ({
    icon: Icon,
    title,
    hint,
  }: {
    icon: typeof User;
    title: string;
    hint?: string;
  }) => (
    <div className="flex items-center gap-3 text-left w-full">
      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium">{title}</div>
        {hint && (
          <div className="text-xs text-muted-foreground truncate">{hint}</div>
        )}
      </div>
    </div>
  );

  return (
    <div>
      <PlayerPageHeader
        icon={UserCog}
        title="Edit Profile"
        subtitle={formData.display_name || formData.first_name || "Your account settings"}
        background="gradient"
      />

      <div className="container mx-auto px-4 pt-4 pb-24 max-w-2xl space-y-4">
        <TournamentReadinessCard completeness={completeness} />

        <Accordion
          type="multiple"
          value={openSections}
          onValueChange={setOpenSections}
          className="space-y-3"
        >
          <AccordionItem
            value="identity"
            className="border rounded-xl bg-card px-4 data-[state=open]:shadow-sm"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <SectionHeader
                icon={User}
                title="Photo & Identity"
                hint={
                  formData.first_name && formData.last_name
                    ? `${formData.first_name} ${formData.last_name}`
                    : "Add your name"
                }
              />
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-4">
              <ProfileIdentitySection
                formData={{
                  first_name: formData.first_name,
                  last_name: formData.last_name,
                  display_name: formData.display_name,
                  avatar_url: formData.avatar_url,
                }}
                onFormChange={handleFormChange}
                onFileUpload={handleFileUpload}
                onRemoveAvatar={handleRemoveAvatar}
                uploading={uploading}
              />
              <div className="flex justify-end">
                <SectionSaveButton
                  section="identity"
                  onClick={() =>
                    saveSection("identity", {
                      first_name: formData.first_name,
                      last_name: formData.last_name,
                      display_name: formData.display_name,
                    })
                  }
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="location"
            className="border rounded-xl bg-card px-4 data-[state=open]:shadow-sm"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <SectionHeader
                icon={MapPin}
                title="Location"
                hint={
                  formData.town || formData.state
                    ? [formData.town, formData.state].filter(Boolean).join(", ")
                    : "Where you play"
                }
              />
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-4">
              <ProfileLocationSection
                formData={{ town: formData.town, state: formData.state }}
                onFormChange={handleFormChange}
              />
              <div className="flex justify-end">
                <SectionSaveButton
                  section="location"
                  onClick={() =>
                    saveSection("location", { town: formData.town, state: formData.state })
                  }
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="tournament"
            className="border rounded-xl bg-card px-4 data-[state=open]:shadow-sm"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <SectionHeader
                icon={Trophy}
                title="Tournament Info"
                hint={
                  completeness.sections.tournament.status === "complete"
                    ? "Ready for tournaments"
                    : "Phone, DOB, gender, skill"
                }
              />
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-4">
              <TournamentInfoTab
                formData={{
                  phone_number: formData.phone_number,
                  date_of_birth: formData.date_of_birth,
                  gender: formData.gender,
                  skill_level_self: formData.skill_level_self,
                }}
                onFormChange={handleFormChange}
              />
              <div className="flex justify-end">
                <SectionSaveButton
                  section="tournament"
                  onClick={() =>
                    saveSection("tournament", {
                      phone_number: formData.phone_number,
                      date_of_birth: formData.date_of_birth,
                      gender: formData.gender,
                      skill_level_self: formData.skill_level_self,
                    })
                  }
                />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem
            value="playstyle"
            className="border rounded-xl bg-card px-4 data-[state=open]:shadow-sm"
          >
            <AccordionTrigger className="hover:no-underline py-3">
              <SectionHeader
                icon={Gamepad2}
                title="Play Style"
              hint="Handedness, side"
              />
            </AccordionTrigger>
            <AccordionContent className="pt-2 pb-4 space-y-4">
              <PlayStyleTab
                formData={{
                  handedness: formData.handedness,
                  play_side: formData.play_side,
                }}
                onFormChange={handleFormChange}
              />
              <div className="flex justify-end">
                <SectionSaveButton
                  section="playstyle"
                  onClick={() =>
                    saveSection("playstyle", {
                      handedness: formData.handedness,
                      play_side: formData.play_side,
                    })
                  }
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Account utilities */}
        <div className="border rounded-xl bg-card divide-y divide-border overflow-hidden">
          <Link
            to="/settings/notifications"
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bell className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Notification preferences</div>
              <div className="text-xs text-muted-foreground">Email, SMS, and push alerts</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </Link>

          <button
            type="button"
            onClick={handleResetPassword}
            disabled={resettingPassword}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors disabled:opacity-60"
          >
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="text-sm font-medium">
                {resettingPassword ? "Sending reset email..." : "Reset password"}
              </div>
              <div className="text-xs text-muted-foreground">Sends a link to your email</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="flex justify-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(returnUrl || "/player/dashboard")}
          >
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
