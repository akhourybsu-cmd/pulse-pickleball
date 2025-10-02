import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/ThemeToggle";

const FAQ = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <ThemeToggle />
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold mb-2">Frequently Asked Questions</h1>
        <p className="text-muted-foreground mb-8">
          Everything you need to know about the rating system
        </p>

        <Accordion type="single" collapsible className="space-y-4">
          <AccordionItem value="how-ratings-work">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <CardTitle className="text-lg text-left">
                  How do ratings work?
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-4 text-sm">
                  <p>
                    We use the <strong>PULSE Rating System</strong> - a weekly-frozen rating system designed specifically for doubles pickleball. Here's how it works:
                  </p>
                  <div className="space-y-2">
                    <p className="font-semibold">Starting Point:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Everyone starts at a rating of 3.00</li>
                      <li>Ratings typically range from 2.0 to 4.5</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold">How Ratings Change:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Win against higher-rated players = bigger rating increase</li>
                      <li>Win against lower-rated players = smaller rating increase</li>
                      <li>Lose to lower-rated players = bigger rating decrease</li>
                      <li>Close games (small score difference) = smaller rating changes</li>
                      <li>Blowout wins = larger rating changes (up to a limit)</li>
                    </ul>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="when-calculated">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <CardTitle className="text-lg text-left">
                  When are ratings calculated?
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-2">
                    <p className="font-semibold">Weekly Freeze System:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Ratings are "frozen" at the start of each week (Monday 00:00)</li>
                      <li>All matches in a week use your rating from the start of that week</li>
                      <li>This prevents your rating from changing mid-week</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold">Example:</p>
                    <p className="ml-4 text-muted-foreground">
                      If you start Monday with a 3.50 rating, every match you play Monday through Sunday will use 3.50 as your rating, even if you win or lose matches during the week. Your new rating takes effect the following Monday.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="font-semibold">Recording Past Matches:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>If you add a match from a previous week, the system automatically recalculates ratings from that week forward</li>
                      <li>This ensures all ratings remain accurate and fair</li>
                    </ul>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="calculation-formula">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <CardTitle className="text-lg text-left">
                  How is the rating change calculated? (Simple Steps)
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-4 text-sm">
                  <p>Here's the step-by-step process for each match:</p>
                  
                  <div className="space-y-3">
                    <div className="border-l-4 border-primary pl-4">
                      <p className="font-semibold">Step 1: Calculate Team Averages</p>
                      <p className="text-muted-foreground">Add up both players' ratings on each team and divide by 2</p>
                      <p className="text-xs mt-1 font-mono bg-muted p-2 rounded">
                        Team Average = (Player 1 Rating + Player 2 Rating) / 2
                      </p>
                    </div>

                    <div className="border-l-4 border-primary pl-4">
                      <p className="font-semibold">Step 2: Calculate Expected Win Probability</p>
                      <p className="text-muted-foreground">
                        The system predicts who should win based on team averages. A team with a higher average has a higher chance to win.
                      </p>
                    </div>

                    <div className="border-l-4 border-primary pl-4">
                      <p className="font-semibold">Step 3: Determine K-Factor (Match Importance)</p>
                      <p className="text-muted-foreground">Different match types have different impacts:</p>
                      <ul className="list-disc list-inside ml-4 mt-1">
                        <li>Casual: 0.0275 (smallest impact)</li>
                        <li>Ladder: 0.055</li>
                        <li>League: 0.075</li>
                        <li>Playoffs: 0.095 (biggest impact)</li>
                      </ul>
                    </div>

                    <div className="border-l-4 border-primary pl-4">
                      <p className="font-semibold">Step 4: Apply Provisional Bonus</p>
                      <p className="text-muted-foreground">
                        New players (fewer than 8 matches) get ratings that move 7% faster to help them reach their true level quickly
                      </p>
                    </div>

                    <div className="border-l-4 border-primary pl-4">
                      <p className="font-semibold">Step 5: Calculate Margin of Victory</p>
                      <p className="text-muted-foreground">
                        Winning 11-9 has less impact than winning 11-4. The system multiplies the change based on how decisively you won (capped at 4-point difference).
                      </p>
                    </div>

                    <div className="border-l-4 border-primary pl-4">
                      <p className="font-semibold">Step 6: Apply the Formula</p>
                      <p className="text-xs font-mono bg-muted p-2 rounded">
                        Rating Change = K × MoV Multiplier × (Actual Result - Expected Result)
                      </p>
                      <p className="text-muted-foreground mt-1">
                        Where Actual Result is 1 if you won, 0 if you lost
                      </p>
                    </div>

                    <div className="border-l-4 border-green-500 pl-4">
                      <p className="font-semibold">Result:</p>
                      <p className="text-muted-foreground">
                        Both players on the winning team get the positive rating change. Both players on the losing team get the negative rating change (same magnitude).
                      </p>
                    </div>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="example">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <CardTitle className="text-lg text-left">
                  Can you show me an example?
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-4 text-sm">
                  <div className="bg-muted p-4 rounded-lg space-y-3">
                    <p className="font-semibold">Example Match:</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="font-semibold text-green-600">Team A (Winners) 11-7</p>
                        <ul className="list-disc list-inside ml-4">
                          <li>Player 1: 3.20 rating</li>
                          <li>Player 2: 3.40 rating</li>
                          <li>Team Average: 3.30</li>
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-red-600">Team B (Losers) 7-11</p>
                        <ul className="list-disc list-inside ml-4">
                          <li>Player 3: 3.50 rating</li>
                          <li>Player 4: 3.70 rating</li>
                          <li>Team Average: 3.60</li>
                        </ul>
                      </div>
                    </div>
                    <div className="border-t pt-3 space-y-2">
                      <p><strong>Match Type:</strong> League (K = 0.075)</p>
                      <p><strong>Score Difference:</strong> 4 points (MoV multiplier ≈ 1.36)</p>
                      <p><strong>What happened:</strong> The lower-rated team upset the higher-rated team!</p>
                      <p className="text-green-600"><strong>Team A players:</strong> Each gains approximately +0.10 to +0.12 rating points</p>
                      <p className="text-red-600"><strong>Team B players:</strong> Each loses approximately -0.10 to -0.12 rating points</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Note: The exact change depends on all factors in the formula, but upsets (lower-rated team winning) result in bigger rating swings!
                    </p>
                  </div>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="refresh-stats">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <CardTitle className="text-lg text-left">
                  What does "Refresh Stats" do?
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-3 text-sm">
                  <p>
                    The <strong>Refresh Stats</strong> button on the dashboard recalculates all ratings from scratch using the current rating system.
                  </p>
                  <div className="space-y-2">
                    <p className="font-semibold">When to use it:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>After matches have been added or updated</li>
                      <li>If you notice ratings don't look correct</li>
                      <li>After any system updates to the rating algorithm</li>
                    </ul>
                  </div>
                  <p className="text-muted-foreground">
                    The refresh processes all matches in chronological order and updates everyone's statistics to ensure accuracy.
                  </p>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="provisional">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <CardTitle className="text-lg text-left">
                  What does "Provisional" mean?
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-3 text-sm">
                  <p>
                    Players are considered <strong>provisional</strong> until they've played at least 8 matches.
                  </p>
                  <div className="space-y-2">
                    <p className="font-semibold">Why provisional status matters:</p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li>Your rating moves 7% faster (1.07x multiplier)</li>
                      <li>This helps you reach your "true" skill level more quickly</li>
                      <li>After 8 matches, the bonus is removed and your rating stabilizes</li>
                    </ul>
                  </div>
                  <p className="text-muted-foreground">
                    This system ensures new players don't stay stuck at 3.00 for too long if they're actually much better or worse than that level.
                  </p>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="contest">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <CardTitle className="text-lg text-left">
                  How do I contest a match result?
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-3 text-sm">
                  <p>
                    If you believe a match result was recorded incorrectly:
                  </p>
                  <ol className="list-decimal list-inside ml-4 space-y-2">
                    <li>Go to your Match History page</li>
                    <li>Find the match you want to contest</li>
                    <li>Click the "Contest Result" button</li>
                    <li>Provide a clear explanation of the issue</li>
                    <li>Submit your contest</li>
                  </ol>
                  <p className="text-muted-foreground">
                    Administrators will be notified and will review the match. They can then correct the score or resolve any disputes.
                  </p>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  );
};

export default FAQ;
