import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  HomepageNav,
  HeroSection,
  QuickActionTiles,
  HowItWorksSection,
  PlayerFeaturesSection,
  SplitCTASection,
  HomepageFooter,
} from "@/components/homepage";
import { consumePostAuthRedirect } from "@/lib/authRedirect";

/**
 * Public landing page.
 *
 * QoL pass — if the user is already authenticated when they hit /, we
 * bounce them straight to the player dashboard instead of showing the
 * marketing page. The previous behavior dropped returning users on a
 * "Get Started" CTA they didn't need; now opening the app behaves like
 * a native app — straight into your hub.
 *
 * Venue/tournament surfaces have also been hidden from the landing
 * page composition — the platform is player-only for the public
 * beta. Routes still resolve directly so admins can reach them.
 */
const Index = () => {
  const [authState, setAuthState] = useState<"checking" | "anonymous" | "authenticated">("checking");

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setAuthState(session ? "authenticated" : "anonymous");
      } catch (error) {
        console.error("Auth check error:", error);
        setAuthState("anonymous");
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setAuthState(session ? "authenticated" : "anonymous");
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (authState === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Authenticated users → straight into the player hub, or the deep link
  // they were trying to reach before the OAuth round-trip.
  if (authState === "authenticated") {
    return <Navigate to={consumePostAuthRedirect()} replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      <HomepageNav isLoggedIn={false} userMode="player" />
      <main>
        {/* Player-only public composition. Venue / tournament surfaces are
            hidden during the player-focused beta — the routes still exist
            for direct navigation, just no UI affordances surface them. */}
        <HeroSection />
        <QuickActionTiles />
        <PlayerFeaturesSection />
        <HowItWorksSection />
        <SplitCTASection />
      </main>
      <HomepageFooter />
    </div>
  );
};

export default Index;
