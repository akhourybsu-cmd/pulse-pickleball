import { useEffect, useState } from "react";
import { useParams, useNavigate, Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import logo from "@/assets/pulse-logo-premium.svg";

export default function TournamentPaymentSuccess() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"verifying" | "success" | "pending">("verifying");
  const [tournamentName, setTournamentName] = useState("");
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (id) {
      pollPaymentStatus();
    }
  }, [id]);

  const pollPaymentStatus = async () => {
    const maxPolls = 10; // Poll for up to 20 seconds (2s intervals)
    let polls = 0;

    const poll = async () => {
      const { data, error } = await supabase
        .from("tournaments_events")
        .select("name, payment_status")
        .eq("id", id)
        .single();

      if (data) {
        setTournamentName(data.name);
        
        if (data.payment_status === "paid") {
          setStatus("success");
          return;
        }
      }

      polls++;
      setPollCount(polls);

      if (polls < maxPolls) {
        setTimeout(poll, 2000);
      } else {
        // After 20 seconds, show pending state
        setStatus("pending");
      }
    };

    poll();
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/tournaments">
            <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <ThemeToggle />
        </div>
      </nav>

      <div className="max-w-lg mx-auto px-4 py-20">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="overflow-hidden">
            <CardContent className="p-8 text-center space-y-6">
              {status === "verifying" && (
                <>
                  <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold">Finalizing Payment...</h1>
                    <p className="text-muted-foreground">
                      Please wait while we confirm your payment
                    </p>
                  </div>
                </>
              )}

              {status === "success" && (
                <>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="mx-auto w-20 h-20 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center"
                  >
                    <CheckCircle2 className="h-10 w-10 text-green-500" />
                  </motion.div>
                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold">Payment Successful!</h1>
                    <p className="text-muted-foreground">
                      Your tournament <span className="font-medium text-foreground">{tournamentName}</span> is now unlocked and ready to manage.
                    </p>
                  </div>
                  <div className="pt-4 space-y-3">
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => navigate(`/tournaments/${id}`)}
                    >
                      <Trophy className="mr-2 h-5 w-5" />
                      Go to Tournament Dashboard
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => navigate("/tournaments")}
                    >
                      View All Tournaments
                    </Button>
                  </div>
                </>
              )}

              {status === "pending" && (
                <>
                  <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-yellow-500 animate-spin" />
                  </div>
                  <div className="space-y-2">
                    <h1 className="text-2xl font-bold">Payment Processing</h1>
                    <p className="text-muted-foreground">
                      Your payment is being processed. This may take a few moments. You can check your tournament status shortly.
                    </p>
                  </div>
                  <div className="pt-4 space-y-3">
                    <Button
                      size="lg"
                      className="w-full"
                      onClick={() => navigate(`/tournaments/${id}`)}
                    >
                      Go to Tournament
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setStatus("verifying");
                        setPollCount(0);
                        pollPaymentStatus();
                      }}
                    >
                      Check Again
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
