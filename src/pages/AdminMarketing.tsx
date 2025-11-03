import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  ArrowLeft,
  Megaphone,
  CheckCircle2,
  TrendingUp,
  Users,
  Trophy,
  Calendar,
  BarChart3,
  Zap,
  Download
} from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";
import leagueFlyer from "@/assets/league-flyer-nov-2025.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { Separator } from "@/components/ui/separator";

const AdminMarketing = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to access admin features");
        navigate("/auth");
        return;
      }

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        toast.error("Access denied: Admin privileges required");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    };

    checkAdminAccess();
  }, [navigate]);

  const handlePrint = () => {
    window.print();
    toast.success("Opening print dialog...");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Checking admin access...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const features = [
    {
      icon: TrendingUp,
      title: "Advanced Rating System",
      description: "Dynamic skill-based ratings that evolve with player performance, ensuring fair and competitive matches."
    },
    {
      icon: Users,
      title: "Complete Community Hub",
      description: "Connect with players across multiple courts in your region. Find partners, track stats, and build your pickleball network."
    },
    {
      icon: BarChart3,
      title: "Comprehensive Match Recording",
      description: "Record every match, track detailed statistics, and monitor your progress over time with visual analytics."
    },
    {
      icon: Calendar,
      title: "Round-Robin Tournament System",
      description: "Host professional-grade round-robin events with automated scheduling, scoring, and real-time leaderboards."
    },
    {
      icon: Trophy,
      title: "Tournament Management",
      description: "Full-featured tournament portal with brackets, divisions, team management, and live scoring capabilities."
    },
    {
      icon: Zap,
      title: "Real-Time Updates",
      description: "Live match updates, instant notifications, and synchronized court displays keep everyone informed."
    }
  ];

  const talkingPoints = [
    "Pulse eliminates the need for multiple apps - everything is integrated in one platform",
    "Our rating system ensures balanced, competitive matches that keep players engaged",
    "Community features help grow your player base and increase court utilization",
    "Professional tournament tools rival paid enterprise solutions, included at no extra cost",
    "Real-time updates and kiosk displays create a premium experience for players",
    "Mobile-first design means players can manage everything from their phone",
    "Detailed analytics help courts understand usage patterns and optimize operations",
    "Automatic match recording reduces administrative burden and improves accuracy"
  ];

  const competitiveAdvantages = [
    {
      category: "vs. Rating-Only Apps",
      advantage: "Pulse includes community features, tournaments, and court management - not just ratings"
    },
    {
      category: "vs. Tournament Apps",
      advantage: "Pulse offers ongoing player engagement between tournaments with ratings and social features"
    },
    {
      category: "vs. Court Booking Apps",
      advantage: "Pulse adds competitive play, skill tracking, and community building to basic reservations"
    },
    {
      category: "vs. All-in-One Competitors",
      advantage: "Pulse is purpose-built for pickleball with features like round-robin automation and kiosk mode"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b bg-secondary print:hidden">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-[90px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Megaphone className="w-8 h-8 text-primary" />
              <h1 className="text-4xl font-bold">Marketing Materials</h1>
            </div>
            <p className="text-muted-foreground">Sales tools and talking points for promoting Pulse</p>
          </div>
          <Button onClick={handlePrint} variant="outline" className="print:hidden">
            <Download className="w-4 h-4 mr-2" />
            Print / Save PDF
          </Button>
        </div>

        {/* One-Pager Section */}
        <Card className="mb-8 border-primary/20">
          <CardHeader>
            <CardTitle className="text-2xl">Pulse: The All-in-One Pickleball Platform</CardTitle>
            <CardDescription className="text-base">
              Why Choose Pulse Over Other Pickleball Apps?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Value Proposition */}
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-6 rounded-lg border border-primary/20">
              <h3 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                The Problem We Solve
              </h3>
              <p className="text-foreground/90 leading-relaxed">
                Most pickleball facilities juggle multiple apps - one for ratings, another for tournaments, 
                a third for court booking, and spreadsheets for everything else. <strong>Pulse unifies all of 
                these functions into a single, powerful platform</strong>, saving time, reducing errors, and 
                creating a seamless experience for players and administrators.
              </p>
            </div>

            {/* Key Features Grid */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Core Features</h3>
              <div className="grid md:grid-cols-2 gap-4">
                {features.map((feature, index) => (
                  <div key={index} className="flex gap-3 p-4 rounded-lg border bg-card">
                    <feature.icon className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-semibold mb-1">{feature.title}</h4>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Competitive Advantages */}
            <div>
              <h3 className="text-xl font-semibold mb-4">Competitive Advantages</h3>
              <div className="space-y-3">
                {competitiveAdvantages.map((item, index) => (
                  <div key={index} className="flex gap-3 items-start">
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold">{item.category}:</span>
                      <span className="text-foreground/90 ml-2">{item.advantage}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Coming Soon */}
            <div className="bg-muted/50 p-4 rounded-lg border">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                More Coming Soon
              </h4>
              <p className="text-sm text-muted-foreground">
                Pulse is continuously evolving with new features based on community feedback. 
                Upcoming additions include enhanced analytics, mobile app improvements, 
                advanced tournament formats, and integration with popular court management systems.
              </p>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        {/* Event Flyers Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Event Flyers</CardTitle>
            <CardDescription>
              Ready-to-use promotional materials for upcoming events
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="border rounded-lg p-6 bg-card">
                <h4 className="font-semibold text-lg mb-3">Advanced Mixed League - November 2025</h4>
                <div className="grid md:grid-cols-2 gap-6 items-start">
                  <div className="space-y-2 text-sm">
                    <p><strong>Event:</strong> 8-Week Round Robin + Playoffs</p>
                    <p><strong>Start Date:</strong> Saturday, November 22nd</p>
                    <p><strong>Time:</strong> 6:00-8:00 PM</p>
                    <p><strong>Location:</strong> Pickleball City, Cranston</p>
                    <p><strong>Players:</strong> 12 Advanced Mixed</p>
                    <p className="pt-2 text-muted-foreground">
                      Download this flyer to share on social media, print for your facility, or include in email newsletters.
                    </p>
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <img 
                      src={leagueFlyer} 
                      alt="Advanced Mixed League Flyer" 
                      className="w-full max-w-[300px] rounded-lg shadow-lg border"
                    />
                    <a 
                      href={leagueFlyer} 
                      download="pulse-advanced-league-nov-2025.png"
                      className="inline-flex items-center gap-2"
                    >
                      <Button variant="outline" size="sm">
                        <Download className="w-4 h-4 mr-2" />
                        Download Flyer
                      </Button>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        {/* Talking Points Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-2xl">Key Talking Points</CardTitle>
            <CardDescription>
              Use these points when discussing Pulse with potential users or facility managers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {talkingPoints.map((point, index) => (
                <div key={index} className="flex gap-3 items-start p-3 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-primary">{index + 1}</span>
                  </div>
                  <p className="text-foreground/90">{point}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Important Notes</CardTitle>
            <CardDescription>
              Key information to remember when promoting Pulse
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-semibold mb-2 text-primary">Target Audience</h4>
                <ul className="text-sm space-y-1 text-foreground/90">
                  <li>• Pickleball facility managers and owners</li>
                  <li>• Tournament organizers and league coordinators</li>
                  <li>• Competitive and recreational players</li>
                  <li>• Community recreation departments</li>
                </ul>
              </div>
              
              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-semibold mb-2 text-primary">Value Drivers</h4>
                <ul className="text-sm space-y-1 text-foreground/90">
                  <li>• Saves administrative time and reduces errors</li>
                  <li>• Increases player engagement and retention</li>
                  <li>• Provides professional-grade tools at low cost</li>
                  <li>• Scales from small clubs to large facilities</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-semibold mb-2 text-primary">Common Objections</h4>
                <ul className="text-sm space-y-1 text-foreground/90">
                  <li>• "We already have a system" → Show integration benefits</li>
                  <li>• "Too complex for our players" → Highlight simple UX</li>
                  <li>• "What about support?" → Emphasize ongoing updates</li>
                </ul>
              </div>

              <div className="p-4 rounded-lg border bg-card">
                <h4 className="font-semibold mb-2 text-primary">Best Practices</h4>
                <ul className="text-sm space-y-1 text-foreground/90">
                  <li>• Focus on specific pain points of the facility</li>
                  <li>• Demo the kiosk mode for visual impact</li>
                  <li>• Share success stories from similar venues</li>
                  <li>• Offer trial period to prove value</li>
                </ul>
              </div>
            </div>

            <div className="mt-6 p-4 bg-primary/10 rounded-lg border border-primary/20">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                The Pulse Promise
              </h4>
              <p className="text-foreground/90">
                "Pulse isn't just software - it's a complete ecosystem designed to elevate the pickleball 
                experience for players, organizers, and facilities. We're committed to continuous innovation, 
                responsive support, and building features that matter to our community."
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default AdminMarketing;
