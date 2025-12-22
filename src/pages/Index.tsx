import { useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, Users, Zap, MapPin, Award, User, Building2, ArrowRight } from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";
import InstallInstructions from "@/components/InstallInstructions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeroSlideshow } from "@/components/HeroSlideshow";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
      <nav className="sticky top-0 z-50 border-b bg-secondary/95 backdrop-blur-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <Link to="/">
            <img src={logo} alt="PULSE Logo" className="h-[67px] sm:h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <Button 
              variant="outline" 
              onClick={() => navigate("/demo")}
              className="text-xs sm:text-sm px-2.5 sm:px-4 h-9 sm:h-10"
            >
              Take a Tour
            </Button>
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
                  className="text-xs sm:text-sm px-2.5 sm:px-4 h-9 sm:h-10"
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

        {/* Role Selector Section */}
        <section className="py-10 sm:py-12 md:py-16 px-3 sm:px-4 bg-gradient-to-b from-background to-muted/30">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-3">
              How Will You Use Pulse?
            </h2>
            <p className="text-center text-muted-foreground mb-8 max-w-2xl mx-auto">
              Pulse serves both players and venues. Choose your path to get started.
            </p>
            
            <div className="grid md:grid-cols-2 gap-6">
              {/* Player Card */}
              <Card 
                className="group cursor-pointer border-2 hover:border-primary/50 transition-all hover:shadow-lg"
                onClick={() => navigate(isLoggedIn ? "/player/dashboard" : "/auth")}
              >
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <User className="w-7 h-7 text-primary" />
                  </div>
                  <CardTitle className="text-xl flex items-center justify-between">
                    I'm a Player
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                  </CardTitle>
                  <CardDescription>
                    Track your progress, find games, and connect with your local pickleball community
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Track your rating and match history
                    </li>
                    <li className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" />
                      Find courts and pickup games nearby
                    </li>
                    <li className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-primary" />
                      Join events and round robins
                    </li>
                    <li className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-primary" />
                      Earn badges and climb leaderboards
                    </li>
                  </ul>
                </CardContent>
              </Card>

              {/* Venue Card */}
              <Card 
                className="group cursor-pointer border-2 hover:border-secondary/50 transition-all hover:shadow-lg"
                onClick={() => navigate(isLoggedIn ? "/venue" : "/auth")}
              >
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-full bg-secondary/10 flex items-center justify-center mb-4 group-hover:bg-secondary/20 transition-colors">
                    <Building2 className="w-7 h-7 text-secondary" />
                  </div>
                  <CardTitle className="text-xl flex items-center justify-between">
                    I'm a Venue / Organizer
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-secondary group-hover:translate-x-1 transition-all" />
                  </CardTitle>
                  <CardDescription>
                    Manage your facility, bookings, events, and grow your pickleball community
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-secondary" />
                      Manage courts and availability
                    </li>
                    <li className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 text-secondary" />
                      Host events and tournaments
                    </li>
                    <li className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-secondary" />
                      Build your player community
                    </li>
                    <li className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-secondary" />
                      Streamline operations
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <section className="py-10 sm:py-12 md:py-16 px-3 sm:px-4 bg-muted/30">
          <div className="container mx-auto">
            <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-6 sm:mb-8 md:mb-12 px-2">Built for Your Local Community</h3>
            <p className="text-center text-muted-foreground text-sm sm:text-base mb-6 sm:mb-8 max-w-2xl mx-auto px-2">
              PULSE creates a friendly, competitive environment where you can track your progress and compare yourself 
              with the players you actually play with—your local community, not a national database.
            </p>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto">
              <Card>
                <CardHeader>
                  <Trophy className="w-10 h-10 text-primary mb-2" />
                  <CardTitle>Dynamic Ratings</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Your rating updates weekly based on match performance and opponent strength
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <TrendingUp className="w-10 h-10 text-secondary mb-2" />
                  <CardTitle>Track Progress</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Monitor your wins, losses, and rating changes over time
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Users className="w-10 h-10 text-primary mb-2" />
                  <CardTitle>Doubles Focused</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Specialized rating system designed specifically for doubles play
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <MapPin className="w-10 h-10 text-secondary mb-2" />
                  <CardTitle>Court Connector</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Find and join pickup games at your local courts - connect with players in your area
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Award className="w-10 h-10 text-secondary mb-2" />
                  <CardTitle>Community Leaderboards</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Compete on local leaderboards and earn badges within your community—see how you rank among your peers
                  </CardDescription>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <Zap className="w-10 h-10 text-primary mb-2" />
                  <CardTitle>Quick Entry</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Record matches in seconds with our simple, intuitive interface
                  </CardDescription>
                </CardContent>
              </Card>
            </div>
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