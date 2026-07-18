import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserPlus, Copy, Check, AlertTriangle, ArrowLeft, Trophy, ExternalLink } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/pulse-logo-premium.svg";

export default function AdminTestAccounts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // League simulation state
  const [simLoading, setSimLoading] = useState(false);
  const [simWeeks, setSimWeeks] = useState("8");
  const [simPlayers, setSimPlayers] = useState("32");
  const [simResult, setSimResult] = useState<
    { manage_url: string; players: number; teams: number; weeks: number; matches: number } | null
  >(null);

  const handleSimulateLeague = async () => {
    setSimLoading(true);
    setSimResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("simulate-league", {
        body: {
          weeks: Number(simWeeks) || 8,
          playerCount: Number(simPlayers) || 32,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setSimResult(data);
      toast.success(
        `League simulated: ${data.players} players, ${data.teams} teams, ${data.matches} matches`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to simulate league";
      toast.error(message);
      console.error(error);
    } finally {
      setSimLoading(false);
    }
  };

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
    } catch (error: unknown) {
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Simulate a League
            </CardTitle>
            <CardDescription>
              Builds a full doubles ladder league <strong>owned by you</strong> — test
              players, teams, weekly sessions, and a round-robin schedule with past
              weeks already scored. Open it from My Leagues → Manage to view, edit, and
              adjust the schedule. Re-running replaces your previous simulated league.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="sim-players">Players (even, 8–40)</Label>
                <Input
                  id="sim-players"
                  type="number"
                  min={8}
                  max={40}
                  step={2}
                  value={simPlayers}
                  onChange={(e) => setSimPlayers(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sim-weeks">Weeks (2–15)</Label>
                <Input
                  id="sim-weeks"
                  type="number"
                  min={2}
                  max={15}
                  value={simWeeks}
                  onChange={(e) => setSimWeeks(e.target.value)}
                />
              </div>
            </div>

            <Button
              onClick={handleSimulateLeague}
              disabled={simLoading}
              className="w-full"
            >
              <Trophy className="mr-2 h-4 w-4" />
              {simLoading ? "Simulating league…" : "Simulate league on my account"}
            </Button>

            {simResult && (
              <Alert>
                <AlertDescription className="space-y-2">
                  <p>
                    Created <strong>{simResult.players}</strong> players ·{" "}
                    <strong>{simResult.teams}</strong> teams ·{" "}
                    <strong>{simResult.weeks}</strong> weeks ·{" "}
                    <strong>{simResult.matches}</strong> matches.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(simResult.manage_url)}
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open league manager
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Test players use emails <code>leaguesim1…N@pulsetest.local</code> and
                password <code>TestPassword123!</code>. League matches never touch PULSE
                Ratings.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
