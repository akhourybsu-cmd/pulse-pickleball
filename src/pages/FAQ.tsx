import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { HelpCircle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ThemeToggle } from "@/components/ThemeToggle";
import logo from "@/assets/pulse-logo-new.png";

const FAQ = () => {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* Pulse Header - Full Width */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-8 md:mb-12"
        style={{
          background: 'linear-gradient(180deg, #E8FBD5 0%, #FFFFFF 80%)',
          borderBottom: '1px solid rgba(169, 220, 61, 0.15)',
        }}
      >
        <div className="container mx-auto px-4 py-6 md:py-8">
          <div className="flex items-start gap-3 md:gap-6">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex-shrink-0"
            >
              <HelpCircle 
                className="w-8 h-8 md:w-12 md:h-12"
                style={{ 
                  color: '#A9DC3D',
                  filter: 'drop-shadow(0px 2px 4px rgba(169, 220, 61, 0.3))'
                }} 
              />
            </motion.div>
            <div className="flex-1 min-w-0">
              <motion.h1
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="text-2xl md:text-4xl lg:text-5xl font-bold mb-2 md:mb-4 relative inline-block pb-2"
                style={{
                  color: '#0E4C58',
                  letterSpacing: '0.02em',
                  textShadow: '0px 1px 2px rgba(14, 76, 88, 0.1)',
                  borderLeft: '3px solid #A9DC3D',
                  paddingLeft: '12px',
                }}
              >
                Frequently Asked Questions
                <motion.span
                  className="absolute bottom-0 left-3 h-0.5 bg-gradient-to-r from-[#A9DC3D] to-transparent"
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                  style={{ display: 'block' }}
                />
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="text-sm md:text-lg leading-relaxed"
                style={{ color: '#0E4C58', opacity: 0.8 }}
              >
                Everything you need to know about PULSE ratings and how they work
              </motion.p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 py-6 space-y-8">

        {/* Section 1: Pulse Score */}
        <div className="space-y-4">
          <div className="border-l-4 border-primary pl-6 py-3 bg-muted/50 rounded-r-lg">
            <h2 className="text-2xl font-bold mb-2">What's a Pulse Score?</h2>
            <p className="text-sm text-muted-foreground">
              Your Pulse Score is a community-focused rating system designed to track your skill level and progress within your local pickleball community. 
              Unlike national ranking systems like DUPR, Pulse Scores are about celebrating your growth, understanding your performance trends, and finding balanced matches with players in your area. 
              It's not about where you rank nationally—it's about your journey and your community.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="simple-breakdown">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <CardTitle className="text-lg text-left">
                  How is my score calculated? (Simple Version)
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-4 text-sm">
                  <p className="text-base">
                    Your rating changes based on <strong>whether you win or lose</strong>, <strong>who you played against</strong>, and <strong>by how much you won or lost</strong>.
                  </p>
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <p>✅ <strong>Beat a higher-rated team?</strong> Your rating goes up a lot!</p>
                    <p>✅ <strong>Beat a lower-rated team?</strong> Your rating goes up a little.</p>
                    <p>❌ <strong>Lose to a lower-rated team?</strong> Your rating goes down a lot.</p>
                    <p>❌ <strong>Lose to a higher-rated team?</strong> Your rating goes down a little.</p>
                    <p>📊 <strong>Score matters:</strong> An 11-4 win changes your rating more than an 11-9 win.</p>
                    <p>🆕 <strong>New player bonus:</strong> If you've played fewer than 8 matches, your rating moves faster to find your true level.</p>
                  </div>
                  <p className="text-muted-foreground">
                    That's it! The system is designed to be fair - upsets matter more, and blowouts have more impact than close games.
                  </p>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

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
          </Accordion>
        </div>

        {/* Section 2: Recording Matches */}
        <div className="space-y-4">
          <div className="border-l-4 border-primary pl-6 py-3 bg-muted/50 rounded-r-lg">
            <h2 className="text-2xl font-bold mb-2">Recording Matches & Match History</h2>
            <p className="text-sm text-muted-foreground">
              Everything you need to know about recording match results, viewing your history, and managing disputed scores.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
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

          <AccordionItem value="record-match">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <CardTitle className="text-lg text-left">
                  How do I record a match?
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-3 text-sm">
                  <p>
                    To record a match result:
                  </p>
                  <ol className="list-decimal list-inside ml-4 space-y-2">
                    <li>Click "New Match" from the dashboard</li>
                    <li>Select all four players (your team and opposing team)</li>
                    <li>Enter the final score</li>
                    <li>Choose the match type (Casual, Ladder, League, or Playoffs)</li>
                    <li>Submit the match</li>
                  </ol>
                  <p className="text-muted-foreground">
                    The match will appear in everyone's match history and ratings will be updated accordingly at the start of the next week.
                  </p>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>

          <AccordionItem value="match-history">
            <Card>
              <AccordionTrigger className="px-6 py-4 hover:no-underline">
                <CardTitle className="text-lg text-left">
                  Where can I see my match history?
                </CardTitle>
              </AccordionTrigger>
              <AccordionContent>
                <CardContent className="space-y-3 text-sm">
                  <p>
                    Your complete match history is available in multiple places:
                  </p>
                  <ul className="list-disc list-inside ml-4 space-y-1">
                    <li><strong>Match History page:</strong> Access from the dashboard to see all your matches with detailed stats</li>
                    <li><strong>Your Profile:</strong> View your recent matches and performance trends</li>
                    <li><strong>Player Profiles:</strong> See head-to-head records when viewing other players</li>
                  </ul>
                  <p className="text-muted-foreground">
                    Each match shows the date, players, score, match type, and how it affected your rating.
                  </p>
                </CardContent>
              </AccordionContent>
            </Card>
          </AccordionItem>
          </Accordion>
        </div>

        {/* Section 3: Round Robin Events */}
        <div className="space-y-4">
          <div className="border-l-4 border-primary pl-6 py-3 bg-muted/50 rounded-r-lg">
            <h2 className="text-2xl font-bold mb-2">Organizing Round Robin Events</h2>
            <p className="text-sm text-muted-foreground">
              Learn how to create and manage round robin events, from player registration to score tracking.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="rr-create">
              <Card>
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <CardTitle className="text-lg text-left">
                    How do I create a round robin event?
                  </CardTitle>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      To create a round robin event:
                    </p>
                    <ol className="list-decimal list-inside ml-4 space-y-2">
                      <li>Navigate to "Round Robin" from the main menu</li>
                      <li>Click "Create New Event"</li>
                      <li>Enter event details (name, date, time, location)</li>
                      <li>Set the number of courts available</li>
                      <li>Configure player limits and registration settings</li>
                      <li>Choose whether to allow self-registration or manual player management</li>
                    </ol>
                    <p className="text-muted-foreground">
                      Once created, you can share the event link with players for registration or add players manually.
                    </p>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="rr-scheduling">
              <Card>
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <CardTitle className="text-lg text-left">
                    How does round robin scheduling work?
                  </CardTitle>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      The system automatically generates fair round robin schedules:
                    </p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li><strong>Partner Rotation:</strong> Players are paired with different partners each round</li>
                      <li><strong>Opponent Variety:</strong> Everyone plays against different opponents</li>
                      <li><strong>Court Optimization:</strong> Matches are distributed across available courts</li>
                      <li><strong>Fairness Algorithm:</strong> Ensures balanced matchups based on skill levels</li>
                    </ul>
                    <p className="text-muted-foreground">
                      You can regenerate schedules or manually adjust pairings in the event management interface.
                    </p>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="rr-kiosk">
              <Card>
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <CardTitle className="text-lg text-left">
                    What is Kiosk Mode?
                  </CardTitle>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      Kiosk Mode provides a full-screen display perfect for tablets or TVs at your event:
                    </p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li><strong>Live Schedule:</strong> Shows current and upcoming matches</li>
                      <li><strong>Court Assignments:</strong> Displays which players are on which courts</li>
                      <li><strong>Score Entry:</strong> Allows quick score input with organizer PIN protection</li>
                      <li><strong>Real-time Updates:</strong> Automatically refreshes as matches complete</li>
                      <li><strong>Standings Board:</strong> Shows current rankings and player performance</li>
                    </ul>
                    <p className="text-muted-foreground">
                      Access Kiosk Mode from any round robin event detail page to provide players with live tournament information.
                    </p>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>

        {/* Section 4: Court Connector */}
        <div className="space-y-4">
          <div className="border-l-4 border-primary pl-6 py-3 bg-muted/50 rounded-r-lg">
            <h2 className="text-2xl font-bold mb-2">Court Connector</h2>
            <p className="text-sm text-muted-foreground">
              Connect with players at your favorite courts, find games, and stay updated with court activity.
            </p>
          </div>

          <Accordion type="single" collapsible className="space-y-4">
            <AccordionItem value="cc-what">
              <Card>
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <CardTitle className="text-lg text-left">
                    What is Court Connector?
                  </CardTitle>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      Court Connector helps you find and connect with players at specific courts:
                    </p>
                    <ul className="list-disc list-inside ml-4 space-y-1">
                      <li><strong>Court Feed:</strong> See posts, updates, and activity from your favorite courts</li>
                      <li><strong>Check-ins:</strong> Let others know when you're heading to a court</li>
                      <li><strong>Looking for Game (LFG):</strong> Post when you need players or find others looking for games</li>
                      <li><strong>Court Analytics:</strong> View peak times and typical player counts</li>
                      <li><strong>Smart Matching:</strong> Get matched with players of similar skill levels</li>
                    </ul>
                    <p className="text-muted-foreground">
                      Access Court Connector from the main menu to start connecting with your local pickleball community.
                    </p>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="cc-checkin">
              <Card>
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <CardTitle className="text-lg text-left">
                    How do check-ins work?
                  </CardTitle>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      Check-ins let you announce your presence at a court:
                    </p>
                    <ol className="list-decimal list-inside ml-4 space-y-2">
                      <li>Navigate to the court's page in Court Connector</li>
                      <li>Click "Check In"</li>
                      <li>Optionally add details like how long you'll be there or what you're looking for</li>
                      <li>Your check-in appears in the court feed for others to see</li>
                    </ol>
                    <p className="text-muted-foreground">
                      Check-ins help coordinate games and let others know when the courts are active. You can also set your availability preferences to automatically notify others.
                    </p>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>

            <AccordionItem value="cc-lfg">
              <Card>
                <AccordionTrigger className="px-6 py-4 hover:no-underline">
                  <CardTitle className="text-lg text-left">
                    How do I use the Looking for Game (LFG) feature?
                  </CardTitle>
                </AccordionTrigger>
                <AccordionContent>
                  <CardContent className="space-y-3 text-sm">
                    <p>
                      The LFG feature helps you find players when you need them:
                    </p>
                    <ol className="list-decimal list-inside ml-4 space-y-2">
                      <li>Go to the court where you want to play</li>
                      <li>Click "Create LFG Post"</li>
                      <li>Specify what you need (1 player, 2 players, etc.)</li>
                      <li>Set when you want to play (now or scheduled time)</li>
                      <li>Wait for others to respond or join</li>
                    </ol>
                    <p className="text-muted-foreground">
                      You'll receive notifications when players respond to your LFG post. You can also browse active LFG posts to join games others have created.
                    </p>
                  </CardContent>
                </AccordionContent>
              </Card>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
