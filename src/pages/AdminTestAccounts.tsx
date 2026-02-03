import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserPlus, Copy, Check, AlertTriangle, ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/pulse-logo-new.png";

export default function AdminTestAccounts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const testAccounts = Array.from({ length: 8 }, (_, i) => ({
    email: `testaccount${i + 1}@pulsetest.local`,
    password: 'TestPassword123!',
    name: `Test Account${i + 1}`
  }));

  const handleCreateAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-test-accounts');
      
      if (error) throw error;
      
      if (data.errors && data.errors.length > 0) {
        toast.error(`Created with ${data.errors.length} error(s)`, {
          description: `${data.created.length} accounts processed successfully`
        });
        console.error('Account creation errors:', data.errors);
      } else {
        toast.success(`Successfully processed ${data.created.length} test accounts!`);
      }
    } catch (error: any) {
      toast.error('Failed to create test accounts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/admin-dashboard">
            <img
              src={logo}
              alt="PULSE Logo"
              className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity"
            />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin-dashboard")}
              className="text-white hover:text-white hover:bg-white/10"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
          </div>
        </div>
      </nav>
      
      <div className="container max-w-4xl mx-auto py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Test Accounts Management</h1>
          <p className="text-muted-foreground">
            Create and manage test accounts for round robin testing
          </p>
        </div>

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Admin Only:</strong> Test accounts are only visible to administrators (akhourybsu@gmail.com). 
            Matches involving test accounts won't appear in regular users' match history.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Create Test Accounts</CardTitle>
            <CardDescription>
              Creates 8 test accounts (Test Account1 through Test Account8) with starting Pulse Score of 3.5
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={handleCreateAccounts} 
              disabled={loading}
              className="w-full"
            >
              <UserPlus className="mr-2 h-4 w-4" />
              {loading ? 'Creating Accounts...' : 'Create/Update Test Accounts'}
            </Button>

            <div className="space-y-2">
              <h3 className="font-semibold text-sm text-muted-foreground">Account Credentials</h3>
              {testAccounts.map((account, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-1">
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground">{account.email}</p>
                    <p className="text-xs text-muted-foreground">Password: {account.password}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(account.email, index * 2)}
                    >
                      {copiedIndex === index * 2 ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(account.password, index * 2 + 1)}
                    >
                      {copiedIndex === index * 2 + 1 ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <Alert>
              <AlertDescription>
                <strong>Note:</strong> All test accounts use the same password: TestPassword123!
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
