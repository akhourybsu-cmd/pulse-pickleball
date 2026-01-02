import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Trophy, 
  TrendingUp, 
  Users, 
  Zap, 
  MapPin, 
  Award, 
  Building2, 
  Calendar,
  BarChart3,
  Settings,
  UserPlus,
  ClipboardList
} from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";
import InstallInstructions from "@/components/InstallInstructions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeroSlideshow } from "@/components/HeroSlideshow";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const playerFeatures = [
  {
    icon: Trophy,
    title: "Dynamic Ratings",
    description: "Your rating updates weekly based on match performance and opponent strength"
  },
  {
    icon: TrendingUp,
    title: "Track Progress",
    description: "Monitor your wins, losses, and rating changes over time"
  },
  {
    icon: Users,
    title: "Doubles Focused",
    description: "Specialized rating system designed specifically for doubles play"
  },
  {
    icon: MapPin,
    title: "Court Connector",
    description: "Find and join pickup games at your local courts - connect with players in your area"
  },
  {
    icon: Award,
    title: "Community Leaderboards",
    description: "Compete on local leaderboards and earn badges within your community"
  },
  {
    icon: Zap,
    title: "Quick Entry",
    description: "Record matches in seconds with our simple, intuitive interface"
  }
];

const venueFeatures = [
  {
    icon: Building2,
    title: "Court Management",
    description: "Manage all your courts with real-time availability and booking status"
  },
  {
    icon: Calendar,
    title: "Event Hosting",
    description: "Create and manage tournaments, clinics, round robins, and social events"
  },
  {
    icon: ClipboardList,
    title: "Online Bookings",
    description: "Accept court reservations online with automated confirmations"
  },
  {
    icon: UserPlus,
    title: "Staff Management",
    description: "Add coaches, staff, and manage roles with granular permissions"
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description: "Track utilization, revenue, and growth with detailed insights"
  },
  {
    icon: Settings,
    title: "White-Label Pages",
    description: "Custom branded public pages with your logo, colors, and branding"
  }
];

const Index = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'player' | 'venue'>('player');

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setIsLoggedIn(true);
      }
      setIsChecking(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const features = selectedMode === 'player' ? playerFeatures : venueFeatures;
  const accentColor = selectedMode === 'player' ? 'primary' : 'secondary';

  if (isChecking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 bg-secondary/95 backdrop-blur-sm border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/">
            <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            {isLoggedIn ? (
              <Button 
                onClick={() => navigate("/player/dashboard")}
                className="text-xs sm:text-sm px-2.5 sm:px-4 h-9 sm:h-10"
              >
                Dashboard
              </Button>
            ) : (
              <>
                <Button 
                  variant="secondary" 
                  onClick={() => navigate("/auth")}
                  className="text-xs sm:text-sm px-2.5 sm:px-4 h-9 sm:h-10 hidden sm:inline-flex"
                >
                  Sign In
                </Button>
                <Button 
                  onClick={() => navigate("/auth")}
                  className="text-xs sm:text-sm px-2.5 sm:px-4 h-9 sm:h-10"
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main>
        <section className="py-8 sm:py-12 md:py-20 px-3 sm:px-4">
          <div className="container mx-auto">
            <HeroSlideshow />
          </div>
        </section>

        {/* Mode Toggle Section */}
        <section className="py-10 sm:py-12 md:py-16 px-3 sm:px-4 bg-gradient-to-b from-background to-muted/30">
          <div className="container mx-auto max-w-5xl">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3">
              How Will You Use Pulse?
            </h2>
            <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
              Pulse serves both players and venues. Select your path to explore features.
            </p>
            
            {/* Toggle Pill */}
            <div className="flex justify-center mb-10">
              <div className="inline-flex p-1 bg-muted rounded-full">
                <button
                  onClick={() => setSelectedMode('player')}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
                    selectedMode === 'player'
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Users className="w-4 h-4 inline mr-2" />
                  I'm a Player
                </button>
                <button
                  onClick={() => setSelectedMode('venue')}
                  className={cn(
                    "px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300",
                    selectedMode === 'venue'
                      ? "bg-secondary text-white shadow-md"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Building2 className="w-4 h-4 inline mr-2" />
                  I'm a Venue
                </button>
              </div>
            </div>
            
            {/* Feature Cards Grid */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-10">
              {features.map((feature, index) => (
                <Card 
                  key={feature.title} 
                  className={cn(
                    "transition-all duration-300 hover:shadow-lg border-2",
                    selectedMode === 'player' 
                      ? "hover:border-primary/30" 
                      : "hover:border-secondary/30"
                  )}
                  style={{
                    animationDelay: `${index * 50}ms`
                  }}
                >
                  <CardHeader>
                    <feature.icon className={cn(
                      "w-10 h-10 mb-2",
                      selectedMode === 'player' ? "text-primary" : "text-secondary"
                    )} />
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* CTA Section */}
            <div className="text-center space-y-4">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button 
                  size="lg"
                  onClick={() => {
                    if (selectedMode === 'venue' && !isLoggedIn) {
                      navigate('/venue/interest');
                    } else {
                      navigate(isLoggedIn 
                        ? (selectedMode === 'player' ? "/player/dashboard" : "/venue") 
                        : "/auth"
                      );
                    }
                  }}
                  className={cn(
                    "min-h-[48px] px-8 text-lg shadow-lg hover:shadow-xl transition-all",
                    selectedMode === 'venue' && "bg-secondary hover:bg-secondary/90 text-white"
                  )}
                >
                  {isLoggedIn 
                    ? `Go to ${selectedMode === 'player' ? 'Player' : 'Venue'} Dashboard`
                    : selectedMode === 'venue' 
                      ? 'Get started with a venue today'
                      : 'Get Started as a Player'
                  }
                </Button>
                {selectedMode === 'venue' && (
                  <Button 
                    size="lg"
                    variant="outline"
                    onClick={() => navigate('/v/pickleball-palace')}
                    className="min-h-[48px] px-8 text-lg border-secondary text-secondary hover:bg-secondary/10"
                  >
                    <Building2 className="w-5 h-5 mr-2" />
                    Try Demo Venue
                  </Button>
                )}
              </div>
              {!isLoggedIn && (
                <p className="text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <button 
                    onClick={() => navigate("/auth")}
                    className="text-primary hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </p>
              )}

              {/* Take a Tour - Below feature cards */}
              {selectedMode === 'player' && (
                <div className="mt-6 pt-6 border-t border-border/30">
                  <p className="text-sm text-muted-foreground mb-3">or</p>
                  <Button 
                    variant="outline" 
                    onClick={() => navigate("/demo")}
                    className="border-primary/30 hover:border-primary/50 hover:bg-primary/5"
                  >
                    Take a Tour — See the Dashboard in Action
                  </Button>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="py-10 sm:py-12 md:py-16 px-3 sm:px-4 bg-muted/30">
          <div className="container mx-auto text-center max-w-3xl">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 px-2">
              Built for Your Local Community
            </h3>
            <p className="text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
              PULSE creates a friendly, competitive environment where you can track your progress and compare yourself 
              with the players you actually play with—your local community, not a national database.
            </p>
          </div>
        </section>

        <InstallInstructions />

        <section className="py-12 sm:py-16 md:py-20 px-3 sm:px-4">
          <div className="container mx-auto text-center max-w-2xl">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 px-2">Ready to Join Your Community?</h3>
            <p className="text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8 px-2">
              Start tracking your local ranking today and see where you stand among the players you compete with every week
            </p>
            <Button 
              size="lg" 
              onClick={() => navigate("/auth")} 
              className="shadow-[var(--shadow-glow)] w-full sm:w-auto min-h-[44px]"
            >
              Create Your Account
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-6 sm:py-8 px-3 sm:px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p className="text-xs sm:text-sm">© 2025 PULSE - Pickleball Universal Level & Skill Estimator</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;