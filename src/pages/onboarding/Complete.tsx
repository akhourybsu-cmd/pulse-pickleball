import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { OnboardingComplete } from "@/components/onboarding";

const CompletePage = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      setUserId(user.id);
    };

    checkAuth();
  }, [navigate]);

  const handleComplete = async () => {
    if (userId) {
      // Mark tutorial as completed
      await supabase
        .from("profiles")
        .update({ tutorial_completed: true })
        .eq("id", userId);
    }
    
    navigate("/player/dashboard");
  };

  return <OnboardingComplete onComplete={handleComplete} />;
};

export default CompletePage;
