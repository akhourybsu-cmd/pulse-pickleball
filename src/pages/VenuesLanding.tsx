import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageSEO } from "@/components/seo/PageSEO";
import { HomepageNav } from "@/components/homepage/HomepageNav";
import { HomepageFooter } from "@/components/homepage/HomepageFooter";
import {
  VenueHero,
  WhyVenuesSection,
  VenueProductShowcase,
  VenueCapabilitiesSection,
  VenueLiveDemoSection,
  HowItWorksVenue,
  VenueUseCasesSection,
  SocialProofVenue,
  FinalConversionVenue,
} from "@/components/venues-landing";

const VenuesLanding = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userMode, setUserMode] = useState<"player" | "venue" | undefined>(undefined);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
      
      if (session) {
        // Default to player mode for venues landing - venue admins would be redirected
        setUserMode("player");
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <HomepageNav isLoggedIn={isLoggedIn} userMode={userMode} />
      <main>
        <VenueHero />
        <WhyVenuesSection />
        <VenueProductShowcase />
        <VenueCapabilitiesSection />
        <VenueLiveDemoSection />
        <HowItWorksVenue />
        <VenueUseCasesSection />
        <SocialProofVenue />
        <FinalConversionVenue />
      </main>
      <HomepageFooter />
    </div>
  );
};

export default VenuesLanding;
