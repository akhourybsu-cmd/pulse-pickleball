import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, Calendar, Plus, MapPin, BarChart3, MessageSquare, CalendarDays, Award, UserIcon, Zap } from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { FlippableBadge } from "@/components/FlippableBadge";
import firstGameBadge from "@/assets/badges/first_game.png";
import dailyGrinder1Badge from "@/assets/badges/daily_grinder_1.png";
import socialButterfly1Badge from "@/assets/badges/social_butterfly_1.png";

const DemoTour = () => {
  const navigate = useNavigate();

  // Fake demo data for "Pickle Pete"
  const demoProfile = {
    display_name: "Pickle Pete",
    current_rating: 3.47,
    week_start_rating: 3.38,
    wins: 12,
    losses: 8,
    total_matches: 20,
    total_points_for: 242,
    total_points_against: 218,
    avg_opponent_rating: 3.42,
  };

  const winRate = ((demoProfile.wins / demoProfile.total_matches) * 100).toFixed(1);
  const totalPointDifferential = demoProfile.total_points_for - demoProfile.total_points_against;
  const pointDifferentialPerGame = (totalPointDifferential / demoProfile.total_matches).toFixed(1);
  const weeklyChange = demoProfile.current_rating - demoProfile.week_start_rating;

  const demoBadges = [
    {
      id: "1",
      code: "first_game",
      name: "First Game",
      description: "Played your first match",
      category: "milestone",
      tier: 1,
      image: firstGameBadge,
    },
    {
      id: "2",
      code: "daily_grinder_1",
      name: "Daily Grinder",
      description: "Played matches on 5 different days",
      category: "consistency",
      tier: 1,
      image: dailyGrinder1Badge,
    },
    {
      id: "3",
      code: "social_butterfly_1",
      name: "Social Butterfly",
      description: "Played with 10 different partners",
      category: "social",
      tier: 1,
      image: socialButterfly1Badge,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-full cursor-default"
            >
              <UserIcon className="h-[1.2rem] w-[1.2rem]" />
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Pulse Header - Full Width */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-2 md:mb-3"
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
              <Zap 
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
                Welcome back, {demoProfile.display_name}!
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
                Track your pickleball journey, analyze your performance, and compete with your community
              </motion.p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="container mx-auto px-4 py-3 md:py-4 md:py-6">
        <div className="mb-6 md:mb-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full mb-6">
                <Button 
                  size="lg" 
                  className="shadow-[var(--shadow-glow)] w-full sm:w-auto rounded-full md:text-lg md:py-6 md:px-8 pulse-glow button-ripple cursor-default"
                  data-tour="record-match"
                >
                  <Plus className="w-5 h-5 md:w-6 md:h-6 mr-2 flex-shrink-0" />
                  Record New Match
                </Button>
              </div>
                
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                <Button 
                  size="lg" 
                  variant="outline"
                  className="relative flex flex-col items-start py-3 h-auto md:text-lg md:py-6 cursor-default [&:hover_span.text-muted-foreground]:text-black"
                  data-tour="court-connector"
                >
                  <div className="flex items-center w-full">
                    <MessageSquare className="w-4 h-4 md:w-6 md:h-6 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-semibold text-[13px] md:text-base leading-tight">Court Connector</span>
                  </div>
                  <span className="text-[11px] md:text-sm text-muted-foreground mt-1 leading-tight">Find a group</span>
                </Button>

                <Button 
                  size="lg"
                  variant="outline"
                  className="flex flex-col items-start py-3 h-auto md:text-lg md:py-6 cursor-default [&:hover_span.text-muted-foreground]:text-black"
                  data-tour="match-history"
                >
                  <div className="flex items-center w-full">
                    <Calendar className="w-4 h-4 md:w-6 md:h-6 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-semibold text-[13px] md:text-base leading-tight">Match History</span>
                  </div>
                  <span className="text-[11px] md:text-sm text-muted-foreground mt-1 leading-tight">View matches</span>
                </Button>

                <Button 
                  size="lg"
                  variant="outline"
                  className="flex flex-col items-start py-3 h-auto md:text-lg md:py-6 cursor-default [&:hover_span.text-muted-foreground]:text-black"
                >
                  <div className="flex items-center w-full">
                    <CalendarDays className="w-4 h-4 md:w-6 md:h-6 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-semibold text-[13px] md:text-base leading-tight">My Event Registrations</span>
                  </div>
                  <span className="text-[11px] md:text-sm text-muted-foreground mt-1 leading-tight">View events</span>
                </Button>

                <Button 
                  size="lg"
                  variant="outline"
                  className="flex flex-col items-start py-3 h-auto md:text-lg md:py-6 cursor-default [&:hover_span.text-muted-foreground]:text-black"
                  data-tour="leaderboard"
                >
                  <div className="flex items-center w-full">
                    <MapPin className="w-4 h-4 md:w-6 md:h-6 mr-1.5 md:mr-2 flex-shrink-0" />
                    <span className="font-semibold text-[13px] md:text-base leading-tight">Court History</span>
                  </div>
                  <span className="text-[11px] md:text-sm text-muted-foreground mt-1 leading-tight">Browse courts</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:gap-6 mb-6 md:mb-8">
          <Card className="border-2 border-primary shadow-[var(--shadow-glow)]">
            <CardHeader className="pb-3 md:pb-4">
              <CardDescription className="md:text-base">Live Pulse Score</CardDescription>
              <CardTitle className="flex items-center gap-3">
                <span className="text-5xl md:text-6xl lg:text-7xl font-bold text-primary pulse-score-number">
                  {demoProfile.current_rating.toFixed(2)}
                </span>
                <svg 
                  className="ecg-pulse flex-shrink-0" 
                  width="60" 
                  height="20" 
                  viewBox="0 0 80 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path 
                    d="M0 12 L20 12 L25 4 L30 20 L35 12 L80 12" 
                    stroke="rgb(163, 230, 53)" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                    pathLength="100"
                  />
                </svg>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-sm md:text-base">
                <span className="text-muted-foreground">Weekly snapshot (Mon): </span>
                <span className="font-semibold">
                  {demoProfile.week_start_rating.toFixed(2)}
                </span>
                <span className={`ml-2 font-semibold ${weeklyChange > 0 ? 'text-green-500' : weeklyChange < 0 ? 'text-red-500' : 'text-muted-foreground'}`}>
                  ({weeklyChange > 0 ? '+' : ''}{weeklyChange.toFixed(2)})
                </span>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <Card className="py-2 md:py-3">
              <CardHeader className="pb-2 pt-3 md:pb-3 md:pt-4">
                <CardDescription className="text-xs md:text-sm">Record</CardDescription>
                <CardTitle className="text-3xl md:text-4xl lg:text-5xl">
                  {demoProfile.wins}W - {demoProfile.losses}L
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs md:text-sm text-muted-foreground pb-3 md:pb-4">
                {demoProfile.total_matches} {demoProfile.total_matches === 1 ? 'match' : 'matches'} played
              </CardContent>
            </Card>

            <Card className="py-2 md:py-3">
              <CardHeader className="pb-2 pt-3 md:pb-3 md:pt-4">
                <CardDescription className="flex items-center gap-2 text-xs md:text-sm">
                  <TrendingUp className="w-3 h-3 md:w-4 md:h-4" />
                  Win Rate
                </CardDescription>
                <CardTitle className="text-3xl md:text-4xl lg:text-5xl">{winRate}%</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <Card className="py-2 md:py-3">
              <CardHeader className="pb-2 pt-3 md:pb-3 md:pt-4">
                <CardDescription className="flex items-center gap-2 text-xs md:text-sm">
                  <BarChart3 className="w-3 h-3 md:w-4 md:h-4" />
                  Point Diff / Game
                </CardDescription>
                <CardTitle className="text-3xl md:text-4xl lg:text-5xl">
                  {parseFloat(pointDifferentialPerGame) > 0 ? "+" : ""}{pointDifferentialPerGame}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs md:text-sm text-muted-foreground pb-3 md:pb-4">
                For: {demoProfile.total_points_for} • Against: {demoProfile.total_points_against}
              </CardContent>
            </Card>

            <Card className="py-2 md:py-3">
              <CardHeader className="pb-2 pt-3 md:pb-3 md:pt-4">
                <CardDescription className="text-xs md:text-sm">Avg. Opponent Rating</CardDescription>
                <CardTitle className="text-3xl md:text-4xl lg:text-5xl">
                  {demoProfile.avg_opponent_rating.toFixed(2)}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs md:text-sm text-muted-foreground pb-3 md:pb-4">
                Strength of schedule
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="mb-8 space-y-6">
          <Card data-tour="court-stats">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Stats by Court
              </CardTitle>
              <CardDescription>Your performance at different venues</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-semibold">Riverside Courts</p>
                    <p className="text-sm text-muted-foreground">8 matches</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">3.52</p>
                    <p className="text-sm text-muted-foreground">5W-3L</p>
                  </div>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-semibold">Community Center</p>
                    <p className="text-sm text-muted-foreground">12 matches</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">3.44</p>
                    <p className="text-sm text-muted-foreground">7W-5L</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card data-tour="badges">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Your Badges
              </CardTitle>
              <CardDescription>Achievements earned from your matches</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3 md:gap-4">
                {demoBadges.map((badge) => (
                  <FlippableBadge key={badge.id} badge={badge} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
          <Button 
            size="lg" 
            variant="outline"
            className="h-auto py-4 md:text-lg md:py-6 cursor-default"
          >
            <Trophy className="w-5 h-5 md:w-6 md:h-6 mr-2" />
            Organize a Round Robin Event
          </Button>

          <Button 
            size="lg" 
            variant="outline"
            className="md:text-lg md:py-6 cursor-default"
          >
            <UserIcon className="w-5 h-5 md:w-6 md:h-6 mr-2" />
            Edit Profile
          </Button>
        </div>

        <Card className="bg-primary/5 border-primary">
          <CardHeader>
            <CardTitle className="text-center text-2xl">Join Pulse Today</CardTitle>
            <CardDescription className="text-center">
              Sign up now to claim your profile and start tracking your stats
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-6">
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")}
              className="shadow-[var(--shadow-glow)]"
            >
              <Trophy className="w-5 h-5 mr-2" />
              Get Started Now
            </Button>
          </CardContent>
        </Card>
      </div>

      <footer className="border-t py-8 px-4 mt-12">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="text-sm">© 2025 PULSE - Pickleball Universal Level & Skill Estimator</p>
        </div>
      </footer>
    </div>
  );
};

export default DemoTour;
