import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, Users, Zap, MapPin, Award } from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";
import InstallInstructions from "@/components/InstallInstructions";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img src={logo} alt="PULSE Logo" className="h-16 w-auto" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="secondary" onClick={() => navigate("/auth")}>
              Sign In
            </Button>
            <Button onClick={() => navigate("/auth")}>
              Get Started
            </Button>
          </div>
        </div>
      </nav>

      <main>
        <section className="py-20 px-4">
          <div className="container mx-auto text-center max-w-4xl">
            <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Pickleball Universal Level & Skill Estimator
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Track your pickleball journey and celebrate your local community's love for the game. 
              Build friendly competition, connect with fellow players, and watch your skills grow through dynamic ratings that evolve with every match.
            </p>
            <Button size="lg" onClick={() => navigate("/auth")} className="shadow-[var(--shadow-glow)]">
              Start Tracking Your Rating
            </Button>
          </div>
        </section>

        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto">
            <h3 className="text-3xl font-bold text-center mb-12">Why PULSE?</h3>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
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
                  <CardTitle>Leaderboards & Badges</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Earn badges and accolades while competing on local leaderboards - stay motivated year-round
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

        <section className="py-20 px-4">
          <div className="container mx-auto text-center max-w-2xl">
            <h3 className="text-3xl font-bold mb-6">Ready to elevate your game?</h3>
            <p className="text-muted-foreground mb-8">
              Join PULSE today and start tracking your pickleball rating with precision
            </p>
            <Button size="lg" onClick={() => navigate("/auth")} className="shadow-[var(--shadow-glow)]">
              Create Your Account
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t py-8 px-4">
        <div className="container mx-auto text-center text-muted-foreground">
          <p>© 2025 PULSE - Pickleball Universal Level & Skill Estimator</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
