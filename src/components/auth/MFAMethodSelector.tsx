import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Mail, Smartphone, Key } from "lucide-react";

interface MFAMethodSelectorProps {
  onSelectMethod: (method: "authenticator" | "email" | "sms") => void;
}

export const MFAMethodSelector = ({ onSelectMethod }: MFAMethodSelectorProps) => {
  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <Shield className="h-12 w-12 text-primary mx-auto mb-2" />
        <h2 className="text-2xl font-bold">Choose Your MFA Method</h2>
        <p className="text-muted-foreground mt-2">
          Select how you want to secure your account
        </p>
      </div>

      <div className="grid gap-4">
        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => onSelectMethod("authenticator")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Authenticator App
            </CardTitle>
            <CardDescription>
              Use Google Authenticator, Authy, or similar apps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Set Up Authenticator
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors" onClick={() => onSelectMethod("email")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Email Code
            </CardTitle>
            <CardDescription>
              Receive verification codes via email
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              Use Email Codes
            </Button>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors opacity-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              SMS Code
            </CardTitle>
            <CardDescription>
              Receive codes via text message (Coming Soon)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>
              Use SMS Codes
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
