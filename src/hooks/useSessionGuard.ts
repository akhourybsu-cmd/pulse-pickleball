import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface UseSessionGuardProps {
  sessionId: string | null;
  onSessionEnd?: () => void;
}

export const useSessionGuard = ({ sessionId, onSessionEnd }: UseSessionGuardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (!sessionId) return;

    // Check session status periodically
    const checkSession = async () => {
      const { data } = await supabase
        .from("sessions")
        .select("status")
        .eq("id", sessionId)
        .single();

      if (data && data.status === "completed") {
        toast({
          title: "Session Ended",
          description: "This session has been closed",
          variant: "destructive",
        });
        
        if (onSessionEnd) {
          onSessionEnd();
        } else {
          navigate("/dashboard");
        }
      }
    };

    checkSession();
    const interval = setInterval(checkSession, 30000); // Check every 30s

    return () => clearInterval(interval);
  }, [sessionId, navigate, toast, onSessionEnd]);
};
