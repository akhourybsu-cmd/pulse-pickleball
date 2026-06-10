import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  HomepageNav,
  HeroSection,
  QuickActionTiles,
  HowItWorksSection,
  TrustBandSection,
  SplitCTASection,
  HomepageFooter,
} from "@/components/homepage";

const Index = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userMode, setUserMode] = useState<"player" | "venue">("player");
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setIsLoggedIn(!!session);

        if (session) {
          // Check if user has venue access
          const { data: venueAccess } = await supabase
            .from("venue_staff")
            .select("venue_id")
            .eq("user_id", session.user.id)
            .limit(1);
          
          if (venueAccess && venueAccess.length > 0) {
            // User has venue access, check their preferred mode from localStorage
            const savedMode = localStorage.getItem("pulse-mode");
            if (savedMode === "venue") {
              setUserMode("venue");
            }
          }
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setIsChecking(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsLoggedIn(!!session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <HomepageNav isLoggedIn={isLoggedIn} userMode={userMode} />
      <main>
        {/* Player-first composition. DualLaneSection (the two co-equal player
            vs venue cards) and TournamentSpotlight were dropped — venue and
            tournament management live behind the mode toggle now, not on the
            homepage. The quiet "I run a venue or event" link in HeroSection
            and SplitCTASection is the single secondary affordance. */}
        <HeroSection />
        <QuickActionTiles />
        <HowItWorksSection />
        <TrustBandSection />
        <SplitCTASection />
      </main>
      <HomepageFooter />
    </div>
  );
};

export default Index;
