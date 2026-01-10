import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingRatingReveal } from "@/components/onboarding";

const RatingRevealPage = () => {
  const navigate = useNavigate();
  const [ratingData, setRatingData] = useState({
    currentRating: 3.0,
    ratingChange: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRating = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("current_rating, week_start_rating")
        .eq("id", user.id)
        .single();

      if (profile) {
        setRatingData({
          currentRating: profile.current_rating || 3.0,
          ratingChange: (profile.current_rating || 3.0) - (profile.week_start_rating || 3.0),
        });
      }

      setLoading(false);
    };

    fetchRating();
  }, [navigate]);

  const handleContinue = () => {
    navigate("/onboarding/complete");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <OnboardingRatingReveal 
      currentRating={ratingData.currentRating}
      ratingChange={ratingData.ratingChange}
      onContinue={handleContinue}
    />
  );
};

export default RatingRevealPage;
