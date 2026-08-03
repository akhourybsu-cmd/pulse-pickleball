import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { TournamentWizard } from "@/components/tournament/TournamentWizard";
import { Logo } from "@/components/Logo";

/**
 * Tournament creation entry point. Formerly gated behind selecting a venue;
 * with the venue feature retired, any authenticated organizer can create a
 * tournament directly.
 */
export default function TournamentNewWithGating() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to create a tournament",
          variant: "destructive",
        });
        navigate("/auth");
        return;
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate, toast]);

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
            <Logo className="h-[52px] sm:h-[65px] w-auto text-secondary-foreground hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      {/* Back Button */}
      <div className="max-w-4xl mx-auto w-full px-4 sm:px-6 pt-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/tournaments")}
          className="text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Tournaments
        </Button>
      </div>

      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <TournamentWizard />
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
