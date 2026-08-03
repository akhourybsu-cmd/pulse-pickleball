import { HomepageNav, HomepageFooter } from "@/components/homepage";
import { PageSEO } from "@/components/seo/PageSEO";
import {
  PlayerHero,
  WhyPulseSection,
  CoreFeaturesSection,
  HowItWorksPlayer,
  SocialProofPlayer,
  UseCasesSection,
  FinalConversionSection,
} from "@/components/players-landing";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const PlayersLanding = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) setIsLoggedIn(true);
    };
    checkAuth();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <PageSEO
        title="PULSE for Players — Track matches, earn your rating, find events"
        description="Record matches, build your Pulse rating, join round robins, find tournaments near you, and stay connected with your pickleball community."
        path="/players"
      />
      <HomepageNav isLoggedIn={isLoggedIn} />
      <main>
        <PlayerHero />
        <WhyPulseSection />
        <CoreFeaturesSection />
        <HowItWorksPlayer />
        <SocialProofPlayer />
        <UseCasesSection />
        <FinalConversionSection />
      </main>
      <HomepageFooter />
    </div>
  );
};

export default PlayersLanding;
