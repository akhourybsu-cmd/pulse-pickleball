import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const TournamentSpotlight = () => {
  const navigate = useNavigate();

  return (
    <section className="py-12 md:py-16 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="max-w-2xl mx-auto border-primary/20 shadow-lg bg-gradient-to-br from-card to-card/80 overflow-hidden">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col items-center text-center">
                {/* Trophy Icon with Glow */}
                <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-4 shadow-[0_0_20px_hsl(var(--primary)/0.3)]">
                  <Trophy className="h-7 w-7 text-primary" />
                </div>

                {/* Title */}
                <h2 className="text-2xl md:text-3xl font-bold font-display mb-2">
                  Tournaments
                </h2>

                {/* Description */}
                <p className="text-muted-foreground mb-6 max-w-md">
                  Join live or upcoming tournaments near you, or host your own with automated brackets and live scoring.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                  <Button
                    size="lg"
                    onClick={() => navigate("/tournaments/browse")}
                    className="group bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg hover:shadow-primary/25 transition-all"
                  >
                    Browse Tournaments
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() => navigate("/tournaments")}
                    className="border-primary/30 hover:border-primary/50 hover:bg-primary/5"
                  >
                    Host a Tournament
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
};
