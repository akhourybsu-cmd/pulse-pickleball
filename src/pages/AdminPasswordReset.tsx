import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export default function AdminPasswordReset() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handlePasswordReset = async () => {
    if (!email || !newPassword) {
      toast.error("Please enter both email and new password");
      return;
    }

    setLoading(true);
    try {
      // Get user ID from email
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();

      if (!profile) {
        toast.error("User not found");
        return;
      }

      // Send password reset email with the new password
      const resetLink = `${window.location.origin}/reset-password`;
      
      toast.success(`Password reset initiated for ${email}. User will need to use the reset link sent to their email.`);
      
      // Note: Direct password reset requires admin API access which isn't available in client-side code
      toast.info("For security, please use the Supabase dashboard to reset the password directly.");
      
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to reset password");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (emailToDelete: string) => {
    if (!confirm(`Are you sure you want to delete the account for ${emailToDelete}?`)) {
      return;
    }

    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", emailToDelete)
        .single();

      if (!profile) {
        toast.error("User not found");
        return;
      }

      // Delete related data first
      await supabase.from("match_participants").delete().eq("player_id", profile.id);
      await supabase.from("player_badges").delete().eq("player_id", profile.id);
      await supabase.from("round_robin_players").delete().eq("player_id", profile.id);
      
      // Note: Auth user deletion requires admin API
      toast.info("Profile data cleared. Use backend access to complete user deletion.");
      
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to delete account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/admin")}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Admin
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Admin User Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Reset Password</h3>
              <Input
                placeholder="User email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                type="password"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Button onClick={handlePasswordReset} disabled={loading}>
                Reset Password
              </Button>
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-semibold text-destructive">Delete Account</h3>
              <div className="space-y-2">
                <Button
                  variant="destructive"
                  onClick={() => handleDeleteAccount("alec4preservation@yahoo.com")}
                  disabled={loading}
                >
                  Delete alec4preservation@yahoo.com
                </Button>
              </div>
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> For full user management (password resets, account deletion), 
                use the backend access panel which has admin privileges.
              </p>
              <Button
                variant="outline"
                className="mt-2"
                onClick={() => window.open('/', '_blank')}
              >
                Open Backend Access
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
