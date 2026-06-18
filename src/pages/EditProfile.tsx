import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, UserCog, User, Trophy, Gamepad2, Bell, Shield } from "lucide-react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { PlayerPageHeader } from "@/components/layout/PlayerPageHeader";

// Profile tab components
import { ProfileBasicsTab } from "@/components/profile/ProfileBasicsTab";
import { TournamentInfoTab } from "@/components/profile/TournamentInfoTab";
import { PlayStyleTab } from "@/components/profile/PlayStyleTab";
import { NotificationsTab } from "@/components/profile/NotificationsTab";
import { SecurityTab } from "@/components/profile/SecurityTab";
import { TournamentReadinessCard } from "@/components/profile/TournamentReadinessCard";

// Profile completeness utilities
import { calculateProfileCompleteness } from "@/lib/profileCompleteness";

interface Court {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface ProfileData {
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  phonetic_name: string | null;
  town: string | null;
  state: string | null;
  notify_score_email: boolean;
  notify_score_sms: boolean;
  notify_score_push: boolean;
  notify_badges_email: boolean;
  notify_badges_sms: boolean;
  notify_badges_push: boolean;
  home_court_id: string | null;
  handedness: string | null;
  play_side: string | null;
  paddle_brand: string | null;
  paddle_model: string | null;
  phone_number: string | null;
  date_of_birth: string | null;
  gender: string | null;
  shirt_size: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  skill_level_self: string | null;
}

const EditProfile = () => {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [highlightLocation, setHighlightLocation] = useState(false);
  const locationSectionRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Tab state with URL param support
  const focusParam = searchParams.get('focus');
  const returnUrl = searchParams.get('return');
  const [activeTab, setActiveTab] = useState(() => {
    if (focusParam === 'tournament') return 'tournament';
    if (focusParam === 'playstyle') return 'playstyle';
    if (focusParam === 'notifications') return 'notifications';
    if (focusParam === 'security') return 'security';
    if (focusParam === 'location') return 'basics';
    return 'basics';
  });

  const [formData, setFormData] = useState<ProfileData>({
    display_name: null,
    first_name: null,
    last_name: null,
    avatar_url: null,
    phonetic_name: null,
    town: null,
    state: null,
    notify_score_email: true,
    notify_score_sms: false,
    notify_score_push: true,
    notify_badges_email: true,
    notify_badges_sms: false,
    notify_badges_push: true,
    home_court_id: null,
    handedness: null,
    play_side: null,
    paddle_brand: null,
    paddle_model: null,
    phone_number: null,
    date_of_birth: null,
    gender: null,
    shirt_size: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    skill_level_self: null,
  });

  // Calculate profile completeness
  const completeness = useMemo(() => calculateProfileCompleteness(formData), [formData]);

  // Section completion status for tab indicators
  const sectionStatus = useMemo(() => ({
    basics: completeness.sections.basics.status,
    tournament: completeness.sections.tournament.status,
    playStyle: completeness.sections.playStyle.status,
  }), [completeness]);

  // Scroll to location section if requested
  useEffect(() => {
    if (searchParams.get('focus') === 'location' && !loading && locationSectionRef.current) {
      locationSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightLocation(true);
      const timer = setTimeout(() => setHighlightLocation(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, loading]);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setUser(user);

      // Fetch profile
      const { data: profileData, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (error) {
        toast.error("Failed to load profile");
        return;
      }

      // Populate form with existing data
      setFormData({
        display_name: profileData.display_name,
        first_name: profileData.first_name,
        last_name: profileData.last_name,
        avatar_url: profileData.avatar_url,
        phonetic_name: profileData.phonetic_name,
        town: profileData.town,
        state: profileData.state,
        notify_score_email: profileData.notify_score_email ?? true,
        notify_score_sms: profileData.notify_score_sms ?? false,
        notify_score_push: profileData.notify_score_push ?? true,
        notify_badges_email: profileData.notify_badges_email ?? true,
        notify_badges_sms: profileData.notify_badges_sms ?? false,
        notify_badges_push: profileData.notify_badges_push ?? true,
        home_court_id: profileData.home_court_id,
        handedness: profileData.handedness,
        play_side: profileData.play_side,
        paddle_brand: profileData.paddle_brand,
        paddle_model: profileData.paddle_model,
        phone_number: profileData.phone_number,
        date_of_birth: profileData.date_of_birth,
        gender: profileData.gender,
        shirt_size: profileData.shirt_size,
        emergency_contact_name: profileData.emergency_contact_name,
        emergency_contact_phone: profileData.emergency_contact_phone,
        skill_level_self: profileData.skill_level_self,
      });

      // Fetch courts
      const { data: courtsData } = await supabase
        .from("courts")
        .select("*")
        .order("state", { ascending: true })
        .order("city", { ascending: true });

      if (courtsData) {
        setCourts(courtsData);
      }

      setLoading(false);
    };

    fetchData();
  }, [navigate]);

  const handleFormChange = (updates: Partial<ProfileData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5242880) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      // Delete old avatar if exists
      if (formData.avatar_url) {
        const oldPath = formData.avatar_url.split('/').pop();
        if (oldPath) {
          await supabase.storage
            .from('avatars')
            .remove([`${user.id}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      setFormData(prev => ({ ...prev, avatar_url: publicUrl }));
      toast.success("Profile picture uploaded!");
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
      const oldPath = formData.avatar_url.split('/').pop();
      if (oldPath) {
        await supabase.storage
          .from('avatars')
          .remove([`${user.id}/${oldPath}`]);
      }

      setFormData(prev => ({ ...prev, avatar_url: null }));
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

  const handleSave = async () => {
    if (!user?.id) return;

    // Validate required fields
    if (!formData.first_name?.trim() || !formData.last_name?.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(formData)
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      
      // If there's a return URL, navigate there instead of dashboard
      if (returnUrl) {
        navigate(returnUrl);
      } else {
        navigate("/player/dashboard");
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  // Status dot component for tabs
  const StatusDot = ({ status }: { status: 'complete' | 'partial' | 'incomplete' }) => {
    if (status === 'complete') return null;
    return (
      <span className={cn(
        "w-2 h-2 rounded-full ml-1.5",
        status === 'incomplete' ? "bg-destructive" : "bg-amber-500"
      )} />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div>
      <PlayerPageHeader
        icon={UserCog}
        title="Edit Profile"
        subtitle={formData.display_name || formData.first_name || "Your account settings"}
        background="gradient"
        action={
          <TournamentReadinessCard completeness={completeness} compact />
        }
      />

      <div className="container mx-auto px-4 pt-4 pb-8 max-w-3xl">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5 mb-6 h-auto">
            <TabsTrigger value="basics" className="flex items-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm">
              <User className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Basics</span>
              <StatusDot status={sectionStatus.basics} />
            </TabsTrigger>
            <TabsTrigger value="tournament" className="flex items-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm">
              <Trophy className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Tournament</span>
              <StatusDot status={sectionStatus.tournament} />
            </TabsTrigger>
            <TabsTrigger value="playstyle" className="flex items-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm">
              <Gamepad2 className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Play Style</span>
              <StatusDot status={sectionStatus.playStyle} />
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm">
              <Bell className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-1.5 py-2.5 px-2 text-xs sm:text-sm">
              <Shield className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basics">
            <ProfileBasicsTab
              formData={{
                first_name: formData.first_name,
                last_name: formData.last_name,
                display_name: formData.display_name,
                avatar_url: formData.avatar_url,
                phonetic_name: formData.phonetic_name,
                town: formData.town,
                state: formData.state,
              }}
              onFormChange={handleFormChange}
              onFileUpload={handleFileUpload}
              onRemoveAvatar={handleRemoveAvatar}
              uploading={uploading}
              highlightLocation={highlightLocation}
              locationRef={locationSectionRef}
            />
          </TabsContent>

          <TabsContent value="tournament">
            <TournamentInfoTab
              formData={{
                phone_number: formData.phone_number,
                date_of_birth: formData.date_of_birth,
                gender: formData.gender,
                shirt_size: formData.shirt_size,
                emergency_contact_name: formData.emergency_contact_name,
                emergency_contact_phone: formData.emergency_contact_phone,
                skill_level_self: formData.skill_level_self,
              }}
              onFormChange={handleFormChange}
              completeness={completeness}
            />
          </TabsContent>

          <TabsContent value="playstyle">
            <PlayStyleTab
              formData={{
                home_court_id: formData.home_court_id,
                handedness: formData.handedness,
                play_side: formData.play_side,
                paddle_brand: formData.paddle_brand,
                paddle_model: formData.paddle_model,
              }}
              onFormChange={handleFormChange}
              courts={courts}
            />
          </TabsContent>

          <TabsContent value="notifications">
            <NotificationsTab
              formData={{
                notify_score_email: formData.notify_score_email,
                notify_score_sms: formData.notify_score_sms,
                notify_score_push: formData.notify_score_push,
                notify_badges_email: formData.notify_badges_email,
                notify_badges_sms: formData.notify_badges_sms,
                notify_badges_push: formData.notify_badges_push,
              }}
              onFormChange={handleFormChange}
            />
          </TabsContent>

          <TabsContent value="security">
            <SecurityTab
              onResetPassword={handleResetPassword}
              resettingPassword={resettingPassword}
            />
          </TabsContent>
        </Tabs>

        {/* Sticky Save Bar — sits above the player bottom nav */}
        <div className="sticky bottom-[88px] md:bottom-[72px] left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border py-3 mt-6 -mx-4 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <div className="container mx-auto max-w-3xl flex gap-3 justify-end">
            <Button variant="outline" onClick={() => navigate("/player/dashboard")}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
