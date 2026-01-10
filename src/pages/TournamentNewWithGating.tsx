import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { TournamentVenueGate } from "@/components/tournament/TournamentVenueGate";
import { TournamentWizard } from "@/components/tournament/TournamentWizard";
import logo from "@/assets/pulse-logo-new.png";

export default function TournamentNewWithGating() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [selectedVenueName, setSelectedVenueName] = useState<string | null>(null);

  // Check for pre-selected venue from URL params
  const urlVenueId = searchParams.get("venueId");

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // If venue is passed in URL, validate and use it
    if (urlVenueId && user) {
      validateAndSelectVenue(urlVenueId);
    }
  }, [urlVenueId, user]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please sign in to create a tournament",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    setUser(user);
    setLoading(false);
  };

  const validateAndSelectVenue = async (venueId: string) => {
    try {
      // Check if user has access to this venue
      const { data: venue } = await supabase
        .from("venues")
        .select("id, name, owner_id")
        .eq("id", venueId)
        .single();

      if (!venue) {
        toast({
          title: "Venue not found",
          description: "The selected venue does not exist",
          variant: "destructive",
        });
        return;
      }

      // Check if user is owner
      if (venue.owner_id === user?.id) {
        setSelectedVenueId(venue.id);
        setSelectedVenueName(venue.name);
        return;
      }

      // Check if user is staff with appropriate role
      const { data: staff } = await supabase
        .from("venue_staff")
        .select("role")
        .eq("venue_id", venueId)
        .eq("user_id", user?.id)
        .eq("is_active", true)
        .in("role", ["manager", "organizer"])
        .single();

      if (staff) {
        setSelectedVenueId(venue.id);
        setSelectedVenueName(venue.name);
      } else {
        toast({
          title: "Access denied",
          description: "You don't have permission to create tournaments for this venue",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error validating venue:", error);
    }
  };

  const handleVenueSelect = async (venueId: string) => {
    // Fetch venue name
    const { data: venue } = await supabase
      .from("venues")
      .select("name")
      .eq("id", venueId)
      .single();

    setSelectedVenueId(venueId);
    setSelectedVenueName(venue?.name || null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
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
            <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* Back Button */}
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (selectedVenueId && !urlVenueId) {
              // Go back to venue selection
              setSelectedVenueId(null);
              setSelectedVenueName(null);
            } else {
              navigate("/tournaments");
            }
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          {selectedVenueId && !urlVenueId ? "Change Venue" : "Back to Tournaments"}
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        <AnimatePresence mode="wait">
          {selectedVenueId ? (
            <motion.div
              key="wizard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              {/* Venue Badge */}
              {selectedVenueName && (
                <div className="flex items-center justify-center gap-2 mb-6 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span>Hosted by <strong className="text-foreground">{selectedVenueName}</strong></span>
                </div>
              )}
              
              <TournamentWizard venueId={selectedVenueId} />
            </motion.div>
          ) : (
            <motion.div
              key="gate"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <TournamentVenueGate onVenueSelect={handleVenueSelect} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Footer />
    </div>
  );
}
