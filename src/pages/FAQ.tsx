import { Link, NavLink, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  HelpCircle,
  TrendingUp,
  CalendarDays,
  Users,
  ArrowRight,
  ArrowLeft,
  Compass,
  MessageCircle,
  Settings,
  Trophy,
  Sparkles,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Logo } from "@/components/Logo";
import { PageSEO } from "@/components/seo/PageSEO";

// Top FAQ entries used to power FAQPage JSON-LD for rich Q&A results.
// Short answers; full content lives in the page below.
const FAQ_SCHEMA_ITEMS: { q: string; a: string }[] = [
  { q: "What is PULSE?", a: "PULSE is the home for pickleball players and venues. Players track matches, earn a Pulse rating, and find events; venues run courts, tournaments, round robins, and communities." },
  { q: "What's a Pulse Score?", a: "Your Pulse Score is a single rating that summarizes your pickleball skill based on the matches you record, who you played, and how the results went." },
  { q: "How does my rating change?", a: "Ratings update after each verified match. Beating higher-rated opponents moves you up faster; expected wins move you up a little." },
  { q: "How do I record a match?", a: "Tap Record Match, pick the players for each team, enter the score, and submit. Opponents verify and the rating updates automatically." },
  { q: "What if someone isn't on PULSE yet?", a: "You can add them as a guest during match entry. Their results count toward your rating and they can claim the profile later." },
  { q: "How do I join a round robin?", a: "Open the Play tab, browse live round robins near you or at your venue, and tap Join. The host approves and you'll get court assignments in the app." },
];

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_SCHEMA_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

// ---------- Reusable bits ----------

const SectionHeader = ({
  icon: Icon,
  title,
  subtitle,
  delay = 0,
  anchor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  delay?: number;
  anchor: string;
}) => (
  <motion.div
    id={anchor}
    initial={{ opacity: 0, x: -20 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.4, delay }}
    className="scroll-mt-24 rounded-lg border-l-4 border-primary bg-primary/5 pl-6 pr-4 py-5"
  >
    <div className="flex items-center gap-3 mb-1">
      <Icon className="h-5 w-5 text-primary" />
      <h2 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
        {title}
      </h2>
    </div>
    <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
      {subtitle}
    </p>
  </motion.div>
);

const FAQItem = ({
  value,
  icon: Icon,
  question,
  children,
}: {
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  question: string;
  children: React.ReactNode;
}) => (
  <AccordionItem value={value} className="border-0">
    <Card className="border border-border/60 border-l-4 border-l-primary/60 hover:shadow-md transition-shadow bg-card">
      <AccordionTrigger className="px-4 md:px-6 py-4 hover:no-underline">
        <div className="flex items-center gap-3 text-left">
          <Icon className="h-5 w-5 text-primary shrink-0" />
          <CardTitle className="text-base md:text-lg">{question}</CardTitle>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <CardContent className="space-y-3 text-sm md:text-[15px] leading-relaxed pt-0">
          {children}
        </CardContent>
      </AccordionContent>
    </Card>
  </AccordionItem>
);

// Inline path chip — renders the navigation breadcrumb you'd tap
const Path = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-foreground/80">
    {children}
  </span>
);

const SECTIONS = [
  { id: "start", label: "Getting Started" },
  { id: "rating", label: "Pulse Score" },
  { id: "matches", label: "Matches" },
  { id: "play", label: "Round Robins" },
  { id: "community", label: "Community" },
  { id: "account", label: "Account" },
];

const FAQ = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <PageSEO
        title="FAQ — How PULSE works"
        description="Answers about Pulse ratings, recording matches, joining round robins, hosting events, and connecting with your pickleball community on PULSE."
        path="/faq"
        jsonLd={FAQ_JSON_LD}
      />
      {/* Sticky PULSE header — matches /player/* surfaces */}
      <header className="sticky top-0 z-50 border-b border-secondary-foreground/10 bg-secondary shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-3 flex items-center justify-between h-[64px] sm:h-[72px]">
          <div className="flex items-center gap-2 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="text-secondary-foreground hover:bg-secondary-foreground/10 -ml-2"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <NavLink
              to="/player/dashboard"
              className="text-secondary-foreground hover:opacity-90 transition-opacity"
              aria-label="Go to dashboard"
            >
              <Logo className="h-[52px] sm:h-[65px] w-auto" />
            </NavLink>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Page heading */}
      <div className="border-b border-border/60 bg-gradient-to-b from-primary/10 via-background to-background">
        <div className="container mx-auto px-4 py-6 md:py-8">
          <div className="flex items-start gap-3 md:gap-4">
            <HelpCircle className="w-8 h-8 md:w-10 md:h-10 text-primary shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl md:text-4xl font-bold text-foreground border-l-[3px] border-primary pl-3 mb-2">
                Help Center
              </h1>
              <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                Quick answers and step-by-step instructions for getting the most out of PULSE.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section jump strip */}
      <div className="sticky top-[64px] sm:top-[72px] z-40 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="container mx-auto px-4 py-2 overflow-x-auto">
          <div className="flex items-center gap-2 whitespace-nowrap">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-xs md:text-sm px-3 py-1.5 rounded-full bg-muted text-foreground/80 hover:bg-primary/15 hover:text-foreground transition-colors"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-10 max-w-3xl">
        {/* 1. Getting Started */}
        <section className="space-y-4">
          <SectionHeader
            anchor="start"
            icon={Compass}
            title="Getting Started"
            subtitle="The 60-second tour of how PULSE is laid out."
          />
          <Accordion type="single" collapsible className="space-y-3">
            <FAQItem value="what-is" icon={Sparkles} question="What is PULSE?">
              <p>
                PULSE is your pickleball home base. Log your matches, build a
                community rating (your Pulse Score), host and join round robins,
                and stay connected with the players you care about — all in one
                place built specifically for pickleball.
              </p>
            </FAQItem>

            <FAQItem value="navigation" icon={Compass} question="How do I get around the app?">
              <p>The bottom navigation has everything you need:</p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li><strong>Home</strong> — your dashboard, upcoming activity, and quick actions</li>
                <li><strong>Matches</strong> — your match history and pending verifications</li>
                <li><strong>Play</strong> — round robins and events to join or host</li>
                <li><strong>Community</strong> — groups, LFG posts, friends, and messages</li>
                <li><strong>Profile</strong> — your stats, settings, and preferences</li>
              </ul>
              <p className="text-muted-foreground">
                The lime <strong>Record Match</strong> button — PULSE's signature
                accent color — is always one tap away from Home and Matches.
              </p>
            </FAQItem>

            <FAQItem value="setup-profile" icon={Settings} question="How do I set up my profile?">
              <p>
                Tap <Path>Profile</Path> → <Path>Edit Profile</Path>. First and last
                name are required so other players can find and tag you. Add a
                photo and your skill level to make matchmaking and event invites
                work better.
              </p>
              <p>
                <Link to="/player/profile/edit" className="text-primary hover:underline inline-flex items-center gap-1">
                  Edit your profile now <ArrowRight className="h-3 w-3" />
                </Link>
              </p>
            </FAQItem>

            <FAQItem value="theme" icon={Settings} question="Light or dark theme?">
              <p>
                PULSE ships with a premium dark theme by default — deep navy
                surfaces with a lime accent designed for high contrast on the
                court. Prefer light? Tap the sun/moon icon in the top bar to
                switch any time. Your choice is remembered on this device.
              </p>
            </FAQItem>
          </Accordion>
        </section>

        {/* 2. Pulse Score */}
        <section className="space-y-4">
          <SectionHeader
            anchor="rating"
            icon={TrendingUp}
            title="Your Pulse Score"
            subtitle="A community rating built around your local games — not a national ranking."
            delay={0.05}
          />
          <Accordion type="single" collapsible className="space-y-3">
            <FAQItem value="what-is-pulse" icon={Sparkles} question="What's a Pulse Score?">
              <p>
                Your Pulse Score is a number — usually somewhere between 2.0 and 4.5 —
                that reflects how you're playing right now in your community. It moves
                up when you win, down when you lose, and the size of the move depends
                on who you played and how decisive the match was.
              </p>
              <p className="text-muted-foreground">
                Everyone starts at <strong>3.00</strong>. It's not a national ranking — it's
                a snapshot of your local play.
              </p>
            </FAQItem>

            <FAQItem value="simple" icon={TrendingUp} question="How does my rating change?">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <p>✅ <strong>Beat a higher-rated team?</strong> Your rating jumps up.</p>
                <p>✅ <strong>Beat a lower-rated team?</strong> Small bump up.</p>
                <p>❌ <strong>Lose to a lower-rated team?</strong> Bigger drop.</p>
                <p>❌ <strong>Lose to a higher-rated team?</strong> Small drop.</p>
                <p>📊 <strong>Score matters:</strong> 11–4 moves the needle more than 11–9.</p>
                <p>🆕 <strong>New player?</strong> Under 8 matches, your rating moves a bit faster so you find your level.</p>
              </div>
            </FAQItem>

            <FAQItem value="when" icon={CalendarDays} question="When are ratings calculated?">
              <p>
                Ratings <strong>freeze every Monday at 00:00</strong>. Every match you play
                that week uses your Monday number. The new rating takes effect the
                following Monday.
              </p>
              <p className="text-muted-foreground">
                If you record a match from a past week, the system recalculates from
                that week forward so the history stays consistent.
              </p>
            </FAQItem>

            <FAQItem value="provisional" icon={Sparkles} question="What does 'Provisional' mean?">
              <p>
                You're <strong>Provisional</strong> until you've completed 8 matches.
                During that time your rating adjusts about 7% faster so you climb
                (or settle) into your real level quickly. The label disappears on
                your 8th match.
              </p>
            </FAQItem>

            <FAQItem value="math" icon={TrendingUp} question="Show me the math (for the curious)">
              <p>The system runs this for each match:</p>
              <ol className="list-decimal list-inside ml-2 space-y-1">
                <li>Average each team's rating (Player 1 + Player 2) ÷ 2</li>
                <li>Predict each team's win probability from those averages</li>
                <li>Pick a K-factor by match type: Casual 0.0275 · Ladder 0.055 · League 0.075 · Playoffs 0.095</li>
                <li>Apply a 7% provisional bonus if you have fewer than 8 matches</li>
                <li>Multiply by a margin-of-victory factor (capped at a 4-point gap)</li>
                <li><span className="font-mono text-xs bg-muted px-2 py-1 rounded">Δ = K × MoV × (Result − Expected)</span></li>
              </ol>
              <p className="text-muted-foreground">
                Both winners get +Δ, both losers get −Δ. Upsets and blowouts move
                ratings the most.
              </p>
            </FAQItem>
          </Accordion>
        </section>

        {/* 3. Matches */}
        <section className="space-y-4">
          <SectionHeader
            anchor="matches"
            icon={CalendarDays}
            title="Recording & Managing Matches"
            subtitle="Log results, review your history, and resolve disputes."
            delay={0.1}
          />
          <Accordion type="single" collapsible className="space-y-3">
            <FAQItem value="record" icon={CalendarDays} question="How do I record a match?">
              <ol className="list-decimal list-inside ml-2 space-y-1">
                <li>Tap the lime <strong>Record Match</strong> button (Home or Matches tab)</li>
                <li>Pick all four players — yourself, your partner, and both opponents</li>
                <li>Enter the final score</li>
                <li>Choose the match type: Casual, Ladder, League, or Playoffs</li>
                <li>Submit</li>
              </ol>
              <p className="text-muted-foreground">
                The match lands in everyone's history immediately. Ratings update on
                the next Monday freeze.
              </p>
              <p>
                <Link to="/player/matches/new" className="text-primary hover:underline inline-flex items-center gap-1">
                  Record a match now <ArrowRight className="h-3 w-3" />
                </Link>
              </p>
            </FAQItem>

            <FAQItem value="guest" icon={Users} question="What if someone isn't on PULSE yet?">
              <p>
                When you pick players, tap <strong>Add as guest</strong> and enter
                their name. The match still counts for the registered players. When
                the guest joins PULSE, their history can be linked to their account.
              </p>
            </FAQItem>

            <FAQItem value="history" icon={CalendarDays} question="Where do I see my match history?">
              <p>
                Open the <Path>Matches</Path> tab. You'll see every match with the
                date, opponents, score, match type, and how it moved your rating.
                Filter by tab to see <strong>Pending</strong> matches awaiting your verification.
              </p>
              <p>
                <Link to="/player/matches" className="text-primary hover:underline inline-flex items-center gap-1">
                  Open Match History <ArrowRight className="h-3 w-3" />
                </Link>
              </p>
            </FAQItem>

            <FAQItem value="verify" icon={HelpCircle} question="How do I verify or contest a match?">
              <p>
                When another player records a match you were in, you get a
                notification and the match appears under <Path>Matches</Path> → <Path>Pending</Path>.
              </p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>If the score is correct, tap <strong>Verify</strong>.</li>
                <li>If something's wrong, tap <strong>Contest</strong> and explain the issue.</li>
              </ul>
              <p className="text-muted-foreground">
                Contested matches go to an organizer or admin to review and correct.
              </p>
            </FAQItem>
          </Accordion>
        </section>

        {/* 4. Play / Round Robins */}
        <section className="space-y-4">
          <SectionHeader
            anchor="play"
            icon={Trophy}
            title="Round Robins"
            subtitle="Host your own session or join one organized by a friend."
            delay={0.15}
          />
          <Accordion type="single" collapsible className="space-y-3">
            <FAQItem value="play-hub" icon={Trophy} question="What's the Play tab for?">
              <p>
                <Path>Play</Path> is where you discover and join round robins
                happening near you, or spin up your own in a couple of minutes.
              </p>
              <p>
                <Link to="/player/play" className="text-primary hover:underline inline-flex items-center gap-1">
                  Open Play <ArrowRight className="h-3 w-3" />
                </Link>
              </p>
            </FAQItem>

            <FAQItem value="rr-join" icon={Users} question="How do I join a round robin?">
              <ol className="list-decimal list-inside ml-2 space-y-1">
                <li>Open <Path>Play</Path></li>
                <li>Browse upcoming round robins or open a direct link from a friend</li>
                <li>Tap the event, then <strong>Register</strong></li>
                <li>You'll see the roster, schedule, and standings once the organizer publishes the rounds</li>
              </ol>
            </FAQItem>

            <FAQItem value="rr-create" icon={CalendarDays} question="How do I host my own round robin?">
              <ol className="list-decimal list-inside ml-2 space-y-1">
                <li>Open <Path>Play</Path> → <strong>Create Round Robin</strong></li>
                <li>Set name, date, time, location, and number of courts</li>
                <li>Choose self-registration or invite players manually</li>
                <li>Share the event link — players can register directly from it</li>
              </ol>
              <p className="text-muted-foreground">
                The schedule generator handles partner rotation, opponent variety,
                and court assignments for you. You can regenerate or hand-tweak any
                round.
              </p>
            </FAQItem>

            <FAQItem value="kiosk" icon={TrendingUp} question="What is Kiosk Mode?">
              <p>
                Kiosk Mode is a full-screen display for a tablet or TV at your
                round robin. Open any event you organize and tap <strong>Open Kiosk</strong>.
              </p>
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li>Live schedule with current and upcoming matches</li>
                <li>Court assignments updating as rounds finish</li>
                <li>Score entry protected by an organizer PIN</li>
                <li>Standings board for players to follow along</li>
              </ul>
            </FAQItem>
          </Accordion>
        </section>

        {/* 5. Community */}
        <section className="space-y-4">
          <SectionHeader
            anchor="community"
            icon={MessageCircle}
            title="Community: Groups, Friends & Messages"
            subtitle="The social side of PULSE — find your people and stay in touch."
            delay={0.2}
          />
          <Accordion type="single" collapsible className="space-y-3">
            <FAQItem value="hub" icon={Users} question="What's in the Community tab?">
              <ul className="list-disc list-inside ml-2 space-y-1">
                <li><strong>Groups</strong> — TeamReach-style spaces for crews, leagues, and open-play circles</li>
                <li><strong>Feed</strong> — posts and highlights from your groups</li>
                <li><strong>LFG</strong> — Looking for Game posts to find players right now</li>
                <li><strong>Messages</strong> — direct messages with friends</li>
              </ul>
              <p>
                <Link to="/player/community" className="text-primary hover:underline inline-flex items-center gap-1">
                  Open Community <ArrowRight className="h-3 w-3" />
                </Link>
              </p>
            </FAQItem>

            <FAQItem value="groups" icon={Users} question="How do I join or create a group?">
              <p>
                In <Path>Community</Path> → <Path>Groups</Path>, browse public groups
                or tap <strong>Create Group</strong> to start your own. Pick a type
                — <strong>Crew</strong> for friends and recurring play,{" "}
                <strong>League</strong> for competitive groups, or{" "}
                <strong>Open Play</strong> for casual sessions. Each group has a
                feed, events, and shared photos.
              </p>
              <p className="text-muted-foreground">
                Have an invite code? Tap <strong>Join by code</strong> and paste it in.
              </p>
            </FAQItem>

            <FAQItem value="group-notifs" icon={Sparkles} question="Can I customize notifications per group?">
              <p>
                Yes. Open any group, tap the menu (⋯) → <strong>Notification
                Settings</strong>. You can mute the whole group or fine-tune posts,
                events, and chat independently. Announcements always come through
                so you don't miss anything critical.
              </p>
            </FAQItem>

            <FAQItem value="lfg" icon={MapPin} question="How does Looking for Game (LFG) work?">
              <ol className="list-decimal list-inside ml-2 space-y-1">
                <li>Open <Path>Community</Path> → <Path>LFG</Path></li>
                <li>Tap <strong>New Post</strong></li>
                <li>Set the location, the time, and how many players you need</li>
                <li>You'll get notified when someone responds</li>
              </ol>
              <p className="text-muted-foreground">
                You can also browse open LFG posts and join one yourself.
              </p>
            </FAQItem>

            <FAQItem value="friends" icon={Users} question="How do I add friends?">
              <p>
                Open any player's profile — from a match, a roster, or a search —
                and tap <strong>Add Friend</strong>. Once they accept, you can
                message them and they show up faster when you're picking players for
                matches and round robins.
              </p>
              <p>
                <Link to="/player/friends" className="text-primary hover:underline inline-flex items-center gap-1">
                  Manage friends <ArrowRight className="h-3 w-3" />
                </Link>
              </p>
            </FAQItem>

            <FAQItem value="dm" icon={MessageCircle} question="How do I send a direct message?">
              <p>
                Tap a friend's name (or their <strong>Message</strong> button on their
                profile) to open a conversation. All your threads live in <Path>Community</Path> → <Path>Messages</Path>.
              </p>
            </FAQItem>
          </Accordion>
        </section>

        {/* 6. Account */}
        <section className="space-y-4">
          <SectionHeader
            anchor="account"
            icon={Settings}
            title="Account, Notifications & Privacy"
            subtitle="Make PULSE work the way you want."
            delay={0.25}
          />
          <Accordion type="single" collapsible className="space-y-3">
            <FAQItem value="notifications" icon={Sparkles} question="How do I manage notifications?">
              <p>
                The bell icon at the top right shows your recent activity. Swipe a
                notification to dismiss it.
              </p>
              <p>
                To tune what you get, open <Path>Profile</Path> → <Path>Notification Preferences</Path>.
                You can toggle alerts for matches, round robins, friends, and
                messages independently — and on Android, make sure push
                notifications are allowed at the system level so they hit your
                lock screen.
              </p>
            </FAQItem>

            <FAQItem value="privacy" icon={Settings} question="Who can see my profile and matches?">
              <p>
                Other players can see your display name, avatar, current Pulse
                Score, and match history. Personal info (email, phone) is private
                and only used for your account.
              </p>
              <p>
                To block someone, open their profile → menu (⋯) → <strong>Block</strong>.
                They won't be able to message you or see your activity.
              </p>
            </FAQItem>

            <FAQItem value="biometric" icon={Settings} question="Can I sign in with Face ID / fingerprint?">
              <p>
                Yes. On a supported device, open <Path>Profile</Path> → <Path>Security</Path>{" "}
                and turn on <strong>Biometric Sign-In</strong>. Next time you launch
                the app, just look at it or tap the sensor.
              </p>
            </FAQItem>

            <FAQItem value="signout" icon={Settings} question="How do I sign out?">
              <p>
                Open <Path>Profile</Path>, scroll to the bottom, and tap{" "}
                <strong>Sign Out</strong>.
              </p>
            </FAQItem>
          </Accordion>
        </section>

        {/* Footer note */}
        <div className="text-center text-sm text-muted-foreground pt-4">
          Didn't find what you were looking for? Email us at{" "}
          <a
            href="mailto:support@pulsepb.com"
            className="text-primary hover:underline"
          >
            support@pulsepb.com
          </a>
          .
        </div>
      </div>
    </div>
  );
};

export default FAQ;
