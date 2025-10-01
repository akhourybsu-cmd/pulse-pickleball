import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, TrendingUp, Users, Zap } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            PULSE
          </h1>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => navigate("/auth")}>
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
              Track your pickleball journey with dynamic ratings that evolve with every match. 
              Get accurate skill assessments and watch your game improve.
            </p>
            <Button size="lg" onClick={() => navigate("/auth")} className="shadow-[var(--shadow-glow)]">
              Start Tracking Your Rating
            </Button>
          </div>
        </section>

        <section className="py-16 px-4 bg-muted/30">
          <div className="container mx-auto">
            <h3 className="text-3xl font-bold text-center mb-12">Why PULSE?</h3>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
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
                  <Zap className="w-10 h-10 text-secondary mb-2" />
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
