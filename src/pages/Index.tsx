import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, Users, Zap, MapPin, Award } from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";
import InstallInstructions from "@/components/InstallInstructions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HeroSlideshow } from "@/components/HeroSlideshow";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="sticky top-0 z-50 border-b bg-secondary/95 backdrop-blur-sm">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <img src={logo} alt="PULSE Logo" className="h-12 sm:h-16 w-auto" />
          <div className="flex items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
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
          </div>
        </div>
      </nav>

      <main>
        <section className="py-8 sm:py-12 md:py-20 px-3 sm:px-4">
          <div className="container mx-auto">
            <HeroSlideshow />
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
