import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingProfileSetup } from "@/components/onboarding";

const ProfileSetupPage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);
      setLoading(false);
    };

    checkAuth();
  }, [navigate]);

  const handleComplete = () => {
    navigate("/onboarding/first-match");
  };

  const handleSkip = () => {
    navigate("/player/dashboard");
  };

  if (loading || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <OnboardingProfileSetup 
      userId={userId}
      onComplete={handleComplete}
      onSkip={handleSkip}
    />
  );
};

export default ProfileSetupPage;
