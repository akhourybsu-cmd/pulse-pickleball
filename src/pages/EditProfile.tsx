import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { ArrowLeft, Save, UserCog, Upload, X, KeyRound } from "lucide-react";
import { motion } from "framer-motion";
import type { User } from "@supabase/supabase-js";
import logo from "@/assets/pulse-logo-new.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { MFAManagement } from "@/components/auth/MFAManagement";

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
}

const EditProfile = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const navigate = useNavigate();

  const [formData, setFormData] = useState<ProfileData>({
    display_name: null,
    first_name: null,
    last_name: null,
    avatar_url: null,
    phonetic_name: null,
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
  });

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

      setFormData({ ...formData, avatar_url: publicUrl });
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

      setFormData({ ...formData, avatar_url: null });
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

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update(formData)
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Profile updated successfully!");
      navigate("/dashboard");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="border-b bg-secondary">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/dashboard">
              <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
            </Link>
            <ThemeToggle />
          </div>
        </nav>
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* Pulse Header - Full Width */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 md:mb-12"
        style={{
          background: 'linear-gradient(180deg, #E8FBD5 0%, #FFFFFF 80%)',
          borderBottom: '1px solid rgba(169, 220, 61, 0.15)',
        }}
      >
        <div className="container mx-auto px-4 py-6 md:py-8">
          <div className="flex items-start gap-3 md:gap-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex-shrink-0"
            >
              <UserCog 
                className="w-8 h-8 md:w-12 md:h-12"
                style={{ 
                  color: '#A9DC3D',
                  filter: 'drop-shadow(0px 2px 4px rgba(169, 220, 61, 0.3))'
                }} 
              />
            </motion.div>
            <div className="flex-1 min-w-0">
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-2xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4 relative inline-block pb-2"
                style={{
                  color: '#0E4C58',
                  letterSpacing: '0.02em',
                  textShadow: '0px 1px 2px rgba(14, 76, 88, 0.1)',
                  borderLeft: '3px solid #A9DC3D',
                  paddingLeft: '12px',
                }}
              >
                Edit Profile - {formData.display_name || formData.first_name || 'User'}
                <motion.span
                  className="absolute bottom-0 left-3 h-0.5 bg-gradient-to-r from-[#A9DC3D] to-transparent"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  style={{ display: 'block' }}
                />
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-sm md:text-lg leading-relaxed"
                style={{ color: '#0E4C58', opacity: 0.8 }}
              >
                Customize your profile, preferences, and notification settings
              </motion.p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 py-6 space-y-6">

        <div className="space-y-6">
          {/* Profile Picture Upload */}
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
                        onClick={handleRemoveAvatar}
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
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    JPG, PNG, or WebP. Max 5MB.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Security */}
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>Manage your account security</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Password</Label>
                  <p className="text-sm text-muted-foreground">
                    Reset your password via email
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleResetPassword}
                  disabled={resettingPassword}
                >
                  <KeyRound className="w-4 h-4 mr-2" />
                  {resettingPassword ? "Sending..." : "Reset Password"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* MFA Management */}
          <MFAManagement />

          {/* Identity & Visuals */}
          <Card>
            <CardHeader>
              <CardTitle>Identity & Visuals</CardTitle>
              <CardDescription>How you appear to other players</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name || ""}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    placeholder="John"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name || ""}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name</Label>
                <Input
                  id="display_name"
                  value={formData.display_name || ""}
                  onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                  placeholder="Alex K."
                />
                <p className="text-xs text-muted-foreground">How you want to be shown on leaderboards</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="phonetic_name">Phonetic Name (optional)</Label>
                  <Input
                    id="phonetic_name"
                    value={formData.phonetic_name || ""}
                    onChange={(e) => setFormData({ ...formData, phonetic_name: e.target.value })}
                    placeholder="AL-ex"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choose how you want to be notified</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-3">Score Confirmation Requests</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify_score_email">Email</Label>
                    <Switch
                      id="notify_score_email"
                      checked={formData.notify_score_email}
                      onCheckedChange={(checked) => setFormData({ ...formData, notify_score_email: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify_score_sms">SMS</Label>
                    <Switch
                      id="notify_score_sms"
                      checked={formData.notify_score_sms}
                      onCheckedChange={(checked) => setFormData({ ...formData, notify_score_sms: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify_score_push">Push Notifications</Label>
                    <Switch
                      id="notify_score_push"
                      checked={formData.notify_score_push}
                      onCheckedChange={(checked) => setFormData({ ...formData, notify_score_push: checked })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-3">Match Approvals & Badge Unlocks</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify_badges_email">Email</Label>
                    <Switch
                      id="notify_badges_email"
                      checked={formData.notify_badges_email}
                      onCheckedChange={(checked) => setFormData({ ...formData, notify_badges_email: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify_badges_sms">SMS</Label>
                    <Switch
                      id="notify_badges_sms"
                      checked={formData.notify_badges_sms}
                      onCheckedChange={(checked) => setFormData({ ...formData, notify_badges_sms: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="notify_badges_push">Push Notifications</Label>
                    <Switch
                      id="notify_badges_push"
                      checked={formData.notify_badges_push}
                      onCheckedChange={(checked) => setFormData({ ...formData, notify_badges_push: checked })}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gameplay Preferences */}
          <Card>
            <CardHeader>
              <CardTitle>Gameplay Preferences</CardTitle>
              <CardDescription>Customize your pickleball experience</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="home_court">Home Court</Label>
                <Select
                  value={formData.home_court_id || ""}
                  onValueChange={(value) => setFormData({ ...formData, home_court_id: value })}
                >
                  <SelectTrigger id="home_court">
                    <SelectValue placeholder="Select your home court" />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={court.id}>
                        {court.name} - {court.city}, {court.state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="handedness">Handedness</Label>
                  <Select
                    value={formData.handedness || ""}
                    onValueChange={(value) => setFormData({ ...formData, handedness: value })}
                  >
                    <SelectTrigger id="handedness">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="right">Right</SelectItem>
                      <SelectItem value="left">Left</SelectItem>
                      <SelectItem value="ambidextrous">Ambidextrous</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="play_side">Play Side Preference</Label>
                  <Select
                    value={formData.play_side || ""}
                    onValueChange={(value) => setFormData({ ...formData, play_side: value })}
                  >
                    <SelectTrigger id="play_side">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="forehand">Forehand</SelectItem>
                      <SelectItem value="backhand">Backhand</SelectItem>
                      <SelectItem value="either">Either</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="paddle_brand">Paddle Brand (optional)</Label>
                  <Input
                    id="paddle_brand"
                    value={formData.paddle_brand || ""}
                    onChange={(e) => setFormData({ ...formData, paddle_brand: e.target.value })}
                    placeholder="e.g., Selkirk"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="paddle_model">Paddle Model (optional)</Label>
                  <Input
                    id="paddle_model"
                    value={formData.paddle_model || ""}
                    onChange={(e) => setFormData({ ...formData, paddle_model: e.target.value })}
                    placeholder="e.g., Vanguard Power Air"
                  />
                </div>
              </div>

            </CardContent>
          </Card>

          <div className="flex gap-4 justify-end">
            <Button variant="outline" onClick={() => navigate("/dashboard")}>
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
