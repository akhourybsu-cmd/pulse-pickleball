import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Shield, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

interface MFAEnrollmentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEnrollmentComplete: () => void;
}

export const MFAEnrollment = ({ open, onOpenChange, onEnrollmentComplete }: MFAEnrollmentProps) => {
  const [step, setStep] = useState<"setup" | "verify">("setup");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleEnroll = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
      });

      if (error) throw error;

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStep("verify");
    } catch (error: any) {
      toast.error(error.message || "Failed to set up MFA");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    setLoading(true);
    try {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.error) throw factors.error;

      const totpFactor = factors.data.totp[0];
      if (!totpFactor) throw new Error("No TOTP factor found");

      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: totpFactor.id,
        code: verifyCode,
      });

      if (error) throw error;

      toast.success("MFA successfully enabled!");
      onEnrollmentComplete();
      onOpenChange(false);
      resetState();
    } catch (error: any) {
      toast.error(error.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setStep("setup");
    setQrCode("");
    setSecret("");
    setVerifyCode("");
    setCopied(false);
  };

  const copySecret = () => {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    toast.success("Secret copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(open) => {
      onOpenChange(open);
      if (!open) resetState();
    }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Enable Two-Factor Authentication
          </DialogTitle>
          <DialogDescription>
            {step === "setup" 
              ? "Protect your account with an extra layer of security"
              : "Scan the QR code with your authenticator app and enter the verification code"}
          </DialogDescription>
        </DialogHeader>

        {step === "setup" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              You'll need an authenticator app like Google Authenticator, Authy, or 1Password to generate verification codes.
            </p>
            <Button onClick={handleEnroll} disabled={loading} className="w-full">
              {loading ? "Setting up..." : "Set Up MFA"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex justify-center p-4 bg-white rounded-lg">
              <QRCodeSVG value={qrCode} size={200} level="M" />
            </div>

            <div className="space-y-2">
              <Label>Manual Entry Code</Label>
              <div className="flex gap-2">
                <Input
                  value={secret}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copySecret}
                  className="shrink-0"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use this code if you can't scan the QR code
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verify-code">Verification Code</Label>
              <Input
                id="verify-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-lg tracking-widest"
              />
            </div>

            <Button
              onClick={handleVerify}
              disabled={loading || verifyCode.length !== 6}
              className="w-full"
            >
              {loading ? "Verifying..." : "Verify and Enable MFA"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
