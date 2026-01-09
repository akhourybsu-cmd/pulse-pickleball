import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { XCircle, ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import logo from "@/assets/pulse-logo-new.png";

export default function TournamentPaymentCancelled() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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
              <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <XCircle className="h-8 w-8 text-muted-foreground" />
              </div>
              
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">Payment Cancelled</h1>
                <p className="text-muted-foreground">
                  No worries! Your tournament has been saved as a draft. You can complete the payment whenever you're ready.
                </p>
              </div>

              <div className="pt-4 space-y-3">
                <Button
                  size="lg"
                  className="w-full"
                  onClick={() => navigate(`/tournaments/${id}`)}
                >
                  <CreditCard className="mr-2 h-5 w-5" />
                  Try Payment Again
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/tournaments")}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Tournaments
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <Footer />
    </div>
  );
}
