import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, AlertTriangle, ExternalLink } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AdminPasswordReset() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-4 space-y-6 max-w-2xl">
        <div className="flex justify-between items-center">
          <Button
            variant="ghost"
            onClick={() => navigate("/admin")}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Button>
          <ThemeToggle />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
            <CardDescription>
              Password resets and account management require backend access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Backend Access Required</AlertTitle>
              <AlertDescription>
                For security reasons, password resets and account deletions must be performed 
                through the backend panel which has admin API privileges. This ensures proper 
                audit logging and prevents unauthorized access.
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <h3 className="font-semibold">Available Actions via Backend:</h3>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li>Reset user passwords securely</li>
                <li>Delete user accounts completely</li>
                <li>View user authentication logs</li>
                <li>Manage user sessions</li>
              </ul>
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-3">
              <p className="text-sm font-medium">
                How to perform user management:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                <li>Open the backend access panel</li>
                <li>Navigate to Authentication → Users</li>
                <li>Find the user by email address</li>
                <li>Use the menu to reset password or delete account</li>
              </ol>
            </div>

            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                // This opens the Lovable Cloud panel
                const cloudButton = document.querySelector('[data-testid="cloud-button"]') as HTMLButtonElement;
                if (cloudButton) {
                  cloudButton.click();
                } else {
                  // Fallback: show instructions
                  alert('Click the "Cloud" button in the left sidebar to access the backend panel.');
                }
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Open Backend Panel
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
