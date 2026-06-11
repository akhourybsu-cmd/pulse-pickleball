import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMode } from "@/contexts/ModeContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { 
  Clock, 
  CheckCircle2, 
  Mail, 
  Phone, 
  Building2,
  MapPin,
  ArrowRight,
  HelpCircle
} from "lucide-react";
import logo from "@/assets/pulse-logo-premium.svg";

interface VenueDetails {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  website_url: string | null;
  verification_requested_at: string | null;
  activation_state: string;
}

export default function VenueVerificationPending() {
  const navigate = useNavigate();
  const { currentVenueId, refreshVenueAccess } = useMode();
  const [venue, setVenue] = useState<VenueDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentVenueId) {
      fetchVenueDetails();
    }
  }, [currentVenueId]);

  const fetchVenueDetails = async () => {
    if (!currentVenueId) return;

    try {
      const { data, error } = await supabase
        .from("venues")
        .select("id, name, city, state, website_url, verification_requested_at, activation_state")
        .eq("id", currentVenueId)
        .single();

      if (error) throw error;

      // If venue is no longer pending verification, redirect to dashboard
      if (data && data.activation_state !== "pending_verification") {
        await refreshVenueAccess();
        navigate("/venue");
        return;
      }

      setVenue(data);
    } catch (error) {
      console.error("Error fetching venue:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Recently";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <nav className="bg-secondary border-b border-secondary-foreground/10">
          <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
            <Skeleton className="h-[60px] w-[150px]" />
            <Skeleton className="h-10 w-10 rounded-md" />
          </div>
        </nav>
        <div className="max-w-2xl mx-auto px-4 py-12">
          <Skeleton className="h-8 w-3/4 mx-auto mb-4" />
          <Skeleton className="h-4 w-1/2 mx-auto mb-8" />
          <Skeleton className="h-[300px] w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Navigation */}
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/tournaments">
            <img 
              src={logo} 
              alt="PULSE Logo" 
              className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" 
            />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-12">
        {/* Status Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-amber-500/10 mb-4">
            <Clock className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Verification in Progress</h1>
          <p className="text-muted-foreground">
            A Pulse representative will contact you to verify your venue ownership.
          </p>
        </div>

        {/* Venue Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle>{venue?.name || "Your Venue"}</CardTitle>
                  {venue?.city && venue?.state && (
                    <CardDescription className="flex items-center gap-1 mt-1">
                      <MapPin className="h-3 w-3" />
                      {venue.city}, {venue.state}
                    </CardDescription>
                  )}
                </div>
              </div>
              <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                Pending Verification
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Submitted: {formatDate(venue?.verification_requested_at)}
            </p>
          </CardContent>
        </Card>

        {/* What to Expect */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">What Happens Next?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">1</span>
              </div>
              <div>
                <p className="font-medium">Verification Call</p>
                <p className="text-sm text-muted-foreground">
                  A Pulse representative will reach out within 24-48 hours to verify your venue ownership.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">2</span>
              </div>
              <div>
                <p className="font-medium">Account Activation</p>
                <p className="text-sm text-muted-foreground">
                  Once verified, you'll receive an email confirming your venue is ready to use.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">3</span>
              </div>
              <div>
                <p className="font-medium">Complete Your Profile</p>
                <p className="text-sm text-muted-foreground">
                  Finish setting up your venue with branding, courts, and events.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Info */}
        <Card className="bg-muted/30">
          <CardContent className="py-6">
            <div className="flex items-center gap-2 mb-3">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              <span className="font-medium">Have Questions?</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Our team is here to help you get started with Pulse.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <a href="mailto:support@pulsepb.com">
                  <Mail className="h-4 w-4 mr-2" />
                  support@pulsepb.com
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Return to Player Dashboard */}
        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => navigate("/player/dashboard")}>
            Return to Player Dashboard
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
