import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowLeft, Save, UserCog } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import logo from "@/assets/pulse-logo.png";

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
  pronouns: string | null;
  notify_score_email: boolean;
  notify_score_sms: boolean;
  notify_score_push: boolean;
  notify_badges_email: boolean;
  notify_badges_sms: boolean;
  notify_badges_push: boolean;
  notify_weekly_digest: boolean;
  home_court_id: string | null;
  handedness: string | null;
  play_side: string | null;
  paddle_brand: string | null;
  paddle_model: string | null;
  accessibility_needs: string | null;
  partner_preferences: string | null;
}

const EditProfile = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const navigate = useNavigate();

  const [formData, setFormData] = useState<ProfileData>({
    display_name: null,
    first_name: null,
    last_name: null,
    avatar_url: null,
    phonetic_name: null,
    pronouns: null,
    notify_score_email: true,
    notify_score_sms: false,
    notify_score_push: true,
    notify_badges_email: true,
    notify_badges_sms: false,
    notify_badges_push: true,
    notify_weekly_digest: true,
    home_court_id: null,
    handedness: null,
    play_side: null,
    paddle_brand: null,
    paddle_model: null,
    accessibility_needs: null,
    partner_preferences: null,
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
        pronouns: profileData.pronouns,
        notify_score_email: profileData.notify_score_email ?? true,
        notify_score_sms: profileData.notify_score_sms ?? false,
        notify_score_push: profileData.notify_score_push ?? true,
        notify_badges_email: profileData.notify_badges_email ?? true,
        notify_badges_sms: profileData.notify_badges_sms ?? false,
        notify_badges_push: profileData.notify_badges_push ?? true,
        notify_weekly_digest: profileData.notify_weekly_digest ?? true,
        home_court_id: profileData.home_court_id,
        handedness: profileData.handedness,
        play_side: profileData.play_side,
        paddle_brand: profileData.paddle_brand,
        paddle_model: profileData.paddle_model,
        accessibility_needs: profileData.accessibility_needs,
        partner_preferences: profileData.partner_preferences,
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
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img src={logo} alt="PULSE Logo" className="h-16 w-auto" />
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <UserCog className="w-8 h-8" />
            Edit Profile
          </h1>
          <p className="text-muted-foreground">Manage your personal information and preferences</p>
        </div>

        <div className="space-y-6">
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
                <div className="space-y-2">
                  <Label htmlFor="pronouns">Preferred Pronouns (optional)</Label>
                  <Input
                    id="pronouns"
                    value={formData.pronouns || ""}
                    onChange={(e) => setFormData({ ...formData, pronouns: e.target.value })}
                    placeholder="they/them"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="avatar_url">Avatar URL (optional)</Label>
                <Input
                  id="avatar_url"
                  type="url"
                  value={formData.avatar_url || ""}
                  onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
                  placeholder="https://example.com/avatar.jpg"
                />
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

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notify_weekly_digest">Weekly Digest</Label>
                  <p className="text-xs text-muted-foreground">Get a weekly summary of your activity</p>
                </div>
                <Switch
                  id="notify_weekly_digest"
                  checked={formData.notify_weekly_digest}
                  onCheckedChange={(checked) => setFormData({ ...formData, notify_weekly_digest: checked })}
                />
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
                <Label htmlFor="home_court">Home Venue</Label>
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

              <div className="space-y-2">
                <Label htmlFor="accessibility_needs">Accessibility Needs (optional, private)</Label>
                <Textarea
                  id="accessibility_needs"
                  value={formData.accessibility_needs || ""}
                  onChange={(e) => setFormData({ ...formData, accessibility_needs: e.target.value })}
                  placeholder="Any accessibility requirements (visible only to you and staff)"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">This information is kept private</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="partner_preferences">Partner Preferences (optional, private)</Label>
                <Textarea
                  id="partner_preferences"
                  value={formData.partner_preferences || ""}
                  onChange={(e) => setFormData({ ...formData, partner_preferences: e.target.value })}
                  placeholder="Your preferences for choosing partners (kept private)"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">This information is kept private</p>
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
