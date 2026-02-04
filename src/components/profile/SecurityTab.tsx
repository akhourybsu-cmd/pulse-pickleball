import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { KeyRound, Download } from "lucide-react";
import { MFAManagement } from "@/components/auth/MFAManagement";
import { BiometricSetup } from "@/components/auth/BiometricSetup";
import { useNavigate } from "react-router-dom";

interface SecurityTabProps {
  onResetPassword: () => void;
  resettingPassword: boolean;
}

export function SecurityTab({
  onResetPassword,
  resettingPassword,
}: SecurityTabProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      {/* Password & Data */}
      <Card>
        <CardHeader>
          <CardTitle>Account Security</CardTitle>
          <CardDescription>Manage your account security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Password</Label>
              <p className="text-sm text-muted-foreground">
                Reset your password via email
              </p>
            </div>
            <Button
              variant="outline"
              onClick={onResetPassword}
              disabled={resettingPassword}
            >
              <KeyRound className="w-4 h-4 mr-2" />
              {resettingPassword ? "Sending..." : "Reset Password"}
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label className="font-medium">Data Export (GDPR)</Label>
              <p className="text-sm text-muted-foreground">
                Download all your personal data
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/profile/data-export')}
            >
              <Download className="w-4 h-4 mr-2" />
              Export My Data
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* MFA Management */}
      <MFAManagement />

      {/* Biometric Authentication */}
      <BiometricSetup />
    </div>
  );
}
