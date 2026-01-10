import { useNavigate } from "react-router-dom";
import { OnboardingFirstMatch } from "@/components/onboarding";

const FirstMatchPage = () => {
  const navigate = useNavigate();

  const handleRecordMatch = () => {
    // Navigate to match wizard with onboarding flag
    navigate("/match/new?onboarding=true");
  };

  const handleSkip = () => {
    navigate("/dashboard");
  };

  return (
    <OnboardingFirstMatch 
      onRecordMatch={handleRecordMatch}
      onSkip={handleSkip}
    />
  );
};

export default FirstMatchPage;
