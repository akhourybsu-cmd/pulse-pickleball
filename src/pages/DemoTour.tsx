import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, Calendar, Plus, MapPin, BarChart3, MessageSquare, CalendarDays, Award, UserIcon } from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useNavigate } from "react-router-dom";
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
          <img src={logo} alt="PULSE Logo" className="h-16 w-auto" />
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

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2">Welcome back, {demoProfile.display_name}!</h2>
              <p className="text-muted-foreground mb-4">Track your pickleball journey</p>
              
              <div className="space-y-3 w-full md:w-auto">
                <Button 
                  size="lg" 
                  className="shadow-[var(--shadow-glow)] w-full md:w-auto cursor-default"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Record New Match
                </Button>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    size="lg" 
                    variant="outline"
                    className="flex flex-col items-start py-3 h-auto cursor-default"
                  >
                    <div className="flex items-center w-full">
                      <MessageSquare className="w-5 h-5 mr-2 flex-shrink-0" />
                      <span className="font-semibold text-sm">Court Connector</span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">Find a group near you</span>
                  </Button>

                  <Button 
                    size="lg" 
                    variant="outline"
                    className="flex flex-col items-start py-3 h-auto cursor-default"
                  >
                    <div className="flex items-center w-full">
                      <Calendar className="w-5 h-5 mr-2 flex-shrink-0" />
                      <span className="font-semibold text-sm">Match History</span>
                    </div>
                    <span className="text-xs text-muted-foreground mt-1">View your matches</span>
                  </Button>
                </div>
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
          <Card>
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Your Badges
              </CardTitle>
              <CardDescription>Achievements earned through your pickleball journey</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                {demoBadges.map((badge) => (
                  <div key={badge.id} className="flex flex-col items-center">
                    <FlippableBadge badge={badge} />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3 mb-8">
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
            <MapPin className="w-5 h-5 md:w-6 md:h-6 mr-2" />
            Court History
          </Button>

          <Button 
            size="lg" 
            variant="outline"
            className="md:text-lg md:py-6 cursor-default"
          >
            <MessageSquare className="w-5 h-5 md:w-6 md:h-6 mr-2" />
            Court Connector
          </Button>

          <Button 
            size="lg" 
            variant="outline"
            className="md:text-lg md:py-6 cursor-default"
          >
            <UserIcon className="w-5 h-5 md:w-6 md:h-6 mr-2" />
            Edit Profile
          </Button>

          <Button 
            size="lg" 
            variant="outline"
            className="md:text-lg md:py-6 cursor-default"
          >
            <Award className="w-5 h-5 md:w-6 md:h-6 mr-2" />
            Check for New Badges
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
