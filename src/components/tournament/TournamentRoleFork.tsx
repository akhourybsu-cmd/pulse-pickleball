import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Settings, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface TournamentRoleForkProps {
  onBrowseClick?: () => void;
  onCreateClick?: () => void;
}

export function TournamentRoleFork({ onBrowseClick, onCreateClick }: TournamentRoleForkProps) {
  const navigate = useNavigate();

  const handleBrowse = () => {
    if (onBrowseClick) {
      onBrowseClick();
    } else {
      navigate("/tournaments/browse");
    }
  };

  const handleCreate = () => {
    if (onCreateClick) {
      onCreateClick();
    } else {
      navigate("/tournaments/new");
    }
  };

  return (
    <section className="py-12 md:py-16 bg-gradient-to-b from-muted/30 to-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h2 className="text-2xl md:text-3xl font-bold mb-2">How can we help?</h2>
          <p className="text-muted-foreground">Choose your path to get started</p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Player Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            whileHover={{ scale: 1.02, y: -4 }}
            className="cursor-pointer"
            onClick={handleBrowse}
          >
            <Card className="h-full border-2 border-border/50 hover:border-primary/50 hover:shadow-[0_0_30px_hsl(var(--primary)/0.15)] transition-all duration-300 bg-gradient-to-br from-card to-card/80">
              <CardContent className="p-6 md:p-8 text-center">
                <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
                  <Trophy className="h-7 w-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-2">For Players</h3>
                <p className="text-muted-foreground mb-6">
                  Find and join upcoming tournaments in your area. Compete, track results, and climb the rankings.
                </p>
                <Button className="w-full group bg-gradient-to-r from-primary to-primary/80">
                  Browse Tournaments
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* Organizer Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            whileHover={{ scale: 1.02, y: -4 }}
            className="cursor-pointer"
            onClick={handleCreate}
          >
            <Card className="h-full border-2 border-border/50 hover:border-secondary/50 hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-card to-card/80">
              <CardContent className="p-6 md:p-8 text-center">
                <div className="w-14 h-14 rounded-xl bg-secondary/20 flex items-center justify-center mx-auto mb-4">
                  <Settings className="h-7 w-7 text-secondary-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">For Organizers</h3>
                <p className="text-muted-foreground mb-6">
                  Host professional tournaments with automated brackets, live scoring, and seamless registration.
                </p>
                <Button variant="secondary" className="w-full group">
                  Create Tournament
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
