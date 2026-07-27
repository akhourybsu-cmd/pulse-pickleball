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

  // Ladder-season simulation state
  const [ladderLoading, setLadderLoading] = useState(false);
  const [ladderReport, setLadderReport] = useState<any | null>(null);

  // Ladder-sim config (global knobs + per-week scenario injection).
  type WeekRow = {
    week: number; sitouts: number; subRequests: number;
    forceTie: boolean; lateSwap: boolean; selfReport: boolean; autoAdvance: boolean;
  };
  const defaultWeekRows = (n: number): WeekRow[] =>
    Array.from({ length: n }, (_, i) => {
      const week = i + 1;
      const base: WeekRow = { week, sitouts: 0, subRequests: 0, forceTie: false, lateSwap: false, selfReport: false, autoAdvance: false };
      if (week === 2) base.subRequests = 4;
      else if (week === 3) base.sitouts = 4;
      else if (week === 4) base.forceTie = true;
      else if (week === 5) { base.lateSwap = true; base.selfReport = true; base.autoAdvance = true; }
      return base;
    });
  const [cfgPlayers, setCfgPlayers] = useState("32");
  const [cfgSubs, setCfgSubs] = useState("6");
  const [cfgCourts, setCfgCourts] = useState("");
  const [cfgWeeks, setCfgWeeks] = useState("5");
  const [cfgSeed, setCfgSeed] = useState("12345");
  const [cfgRating, setCfgRating] = useState(true);
  const [weekRows, setWeekRows] = useState<WeekRow[]>(defaultWeekRows(5));

  // Keep the per-week rows in sync with the week count (preserve edits).
  const syncWeekRows = (weeksStr: string) => {
    setCfgWeeks(weeksStr);
    const n = Math.max(1, Math.min(12, Number(weeksStr) || 1));
    setWeekRows((prev) => {
      const fresh = defaultWeekRows(n);
      return fresh.map((f) => prev.find((p) => p.week === f.week) ?? f);
    });
  };
  const patchWeek = (week: number, patch: Partial<WeekRow>) =>
    setWeekRows((prev) => prev.map((r) => (r.week === week ? { ...r, ...patch } : r)));

  const handleSimulateLadder = async (mode: "run" | "teardown") => {
    setLadderLoading(true);
    if (mode === "run") setLadderReport(null);
    try {
      const config = mode === "run" ? {
        playerCount: Number(cfgPlayers) || 32,
        subCount: Number(cfgSubs) || 0,
        courtCount: cfgCourts ? Number(cfgCourts) : undefined,
        totalWeeks: Number(cfgWeeks) || 5,
        seed: Number(cfgSeed) || 0,
        ratingEligible: cfgRating,
        weeks: weekRows.map((r) => ({
          week: r.week,
          sitouts: r.sitouts || undefined,
          subRequests: r.subRequests || undefined,
          forceTie: r.forceTie || undefined,
          lateSwap: r.lateSwap || undefined,
          selfReport: r.selfReport || undefined,
          autoAdvance: r.autoAdvance || undefined,
        })),
      } : undefined;
      const { data, error } = await supabase.functions.invoke("simulate-ladder-season", {
        body: { mode, config },
      });
      if (error) throw error;
      if (mode === "teardown") {
        toast.success(`Teardown: removed ${data?.leagues_deleted ?? 0} league(s), ${data?.users_deleted ?? 0} test users`);
        setLadderReport(null);
      } else {
        setLadderReport(data);
        const fails = (data?.weeks ?? []).flatMap((w: any) =>
          (w.assertions ?? []).filter((a: any) => !a.passed).map((a: any) => `W${w.week}: ${a.name}`),
        );
        if (data?.fatal) toast.error(`Fatal: ${data.fatal}`);
        else if (fails.length) toast.error(`${fails.length} assertion(s) failed`);
        else toast.success("Ladder simulation complete — all assertions passed");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Simulation failed");
      console.error(e);
    } finally {
      setLadderLoading(false);
    }
  };

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

        {/* Ladder-season simulation (5-week end-to-end drive) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              Simulate Ladder Season (dev)
            </CardTitle>
            <CardDescription>
              Drives a full Individual Doubles Ladder end-to-end through the real
              RPCs, edge functions and triggers. Configure the season below, then
              per-week inject sit-outs, sub requests, a forced tiebreak, a late
              swap, self-report or auto-advance. Returns a per-week assertion report.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Global knobs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Players (×4)</Label>
                <Input type="number" min={8} max={64} step={4} value={cfgPlayers}
                  onChange={(e) => setCfgPlayers(e.target.value)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Sub pool</Label>
                <Input type="number" min={0} max={16} value={cfgSubs}
                  onChange={(e) => setCfgSubs(e.target.value)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Courts (blank = max)</Label>
                <Input type="number" min={1} value={cfgCourts} placeholder="auto"
                  onChange={(e) => setCfgCourts(e.target.value)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Weeks</Label>
                <Input type="number" min={1} max={12} value={cfgWeeks}
                  onChange={(e) => syncWeekRows(e.target.value)} className="h-8" />
              </div>
              <div>
                <Label className="text-xs">Seed</Label>
                <Input type="number" value={cfgSeed}
                  onChange={(e) => setCfgSeed(e.target.value)} className="h-8" />
              </div>
              <label className="flex items-center gap-2 text-xs mt-5">
                <input type="checkbox" checked={cfgRating}
                  onChange={(e) => setCfgRating(e.target.checked)} />
                Rating-eligible
              </label>
            </div>

            {/* Per-week scenario injection */}
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left font-medium px-2 py-1.5">Week</th>
                    <th className="font-medium px-1 py-1.5">Sit-outs</th>
                    <th className="font-medium px-1 py-1.5">Sub reqs</th>
                    <th className="font-medium px-1 py-1.5">Tie</th>
                    <th className="font-medium px-1 py-1.5">Late swap</th>
                    <th className="font-medium px-1 py-1.5">Self-report</th>
                    <th className="font-medium px-1 py-1.5">Auto-adv</th>
                  </tr>
                </thead>
                <tbody>
                  {weekRows.map((r) => (
                    <tr key={r.week} className="border-b last:border-0">
                      <td className="px-2 py-1 font-semibold">W{r.week}</td>
                      <td className="px-1 py-1 text-center">
                        <Input type="number" min={0} value={r.sitouts}
                          onChange={(e) => patchWeek(r.week, { sitouts: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-7 w-14 mx-auto text-center" disabled={r.week === 1} />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <Input type="number" min={0} value={r.subRequests}
                          onChange={(e) => patchWeek(r.week, { subRequests: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-7 w-14 mx-auto text-center" disabled={r.week === 1} />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input type="checkbox" checked={r.forceTie}
                          onChange={(e) => patchWeek(r.week, { forceTie: e.target.checked })} />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input type="checkbox" checked={r.lateSwap}
                          onChange={(e) => patchWeek(r.week, { lateSwap: e.target.checked })} />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input type="checkbox" checked={r.selfReport}
                          onChange={(e) => patchWeek(r.week, { selfReport: e.target.checked })} />
                      </td>
                      <td className="px-1 py-1 text-center">
                        <input type="checkbox" checked={r.autoAdvance}
                          onChange={(e) => patchWeek(r.week, { autoAdvance: e.target.checked })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Week 1 is always a clean full week (sit-outs/sub-requests start week 2).
              Sit-out counts that aren't a multiple of four are auto-adjusted after
              demonstrating the ÷4 gate. A forced tie needs at least 3 courts.
            </p>

            <div className="flex gap-2">
              <Button
                onClick={() => handleSimulateLadder("run")}
                disabled={ladderLoading}
                className="flex-1"
              >
                <Trophy className="mr-2 h-4 w-4" />
                {ladderLoading ? "Running…" : `Run ${cfgWeeks}-week simulation`}
              </Button>
              <Button
                onClick={() => handleSimulateLadder("teardown")}
                disabled={ladderLoading}
                variant="outline"
              >
                Teardown
              </Button>
            </div>

            {ladderReport && (
              <div className="space-y-3">
                {ladderReport.fatal && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription><strong>Fatal:</strong> {ladderReport.fatal}</AlertDescription>
                  </Alert>
                )}
                <Alert>
                  <AlertDescription>
                    <strong>Status:</strong>{" "}
                    {ladderReport.success ? "✅ All assertions passed" : "⚠️ Some assertions failed"}
                    {ladderReport.manage_url && (
                      <>
                        {" · "}
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => navigate(ladderReport.manage_url)}
                        >
                          Open league <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </AlertDescription>
                </Alert>

                {(ladderReport.weeks ?? []).map((w: any) => (
                  <div key={w.week} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Week {w.week}</p>
                      <span className="text-xs text-muted-foreground">
                        {w.assertions.filter((a: any) => a.passed).length}/{w.assertions.length} passed
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{w.scenario}</p>
                    <ul className="text-xs space-y-1">
                      {w.assertions.map((a: any, i: number) => (
                        <li key={i} className={a.passed ? "text-emerald-600" : "text-destructive"}>
                          {a.passed ? "✓" : "✗"} {a.name}
                          {!a.passed && a.detail != null && (
                            <span className="ml-1 opacity-70">— {typeof a.detail === "string" ? a.detail : JSON.stringify(a.detail)}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {ladderReport.rating_deltas?.length > 0 && (
                  <details className="border rounded-lg p-3">
                    <summary className="cursor-pointer font-semibold text-sm">
                      Rating deltas ({ladderReport.rating_deltas.length} players)
                    </summary>
                    <div className="mt-2 max-h-60 overflow-y-auto text-xs space-y-1">
                      {ladderReport.rating_deltas.map((d: any, i: number) => (
                        <div key={i} className="flex justify-between">
                          <span>{d.player}</span>
                          <span className="text-muted-foreground">
                            {d.before?.toFixed?.(3) ?? "—"} → {d.after?.toFixed?.(3) ?? "—"} ({d.games}g)
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
