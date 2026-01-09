import { motion } from "framer-motion";
import { Check, Trophy, Layers, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const FEATURES = [
  "Unlimited team registrations",
  "Automated bracket generation",
  "Live scoring & standings",
  "Player check-in system",
  "Shareable tournament page",
  "Email notifications",
];

interface PricingShowcaseProps {
  onGetStarted?: () => void;
}

export function PricingShowcase({ onGetStarted }: PricingShowcaseProps) {
  const navigate = useNavigate();

  return (
    <section className="py-8 px-4">
      <div className="max-w-5xl mx-auto">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Tournament License Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            whileHover={{ y: -4 }}
            className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-accent/10 border border-primary/30 rounded-2xl p-8 overflow-hidden group"
          >
            {/* Hover glow effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            
            {/* Most Popular badge with pulse glow */}
            <div className="absolute top-0 right-0 bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-1.5 rounded-bl-xl text-sm font-semibold shadow-[0_0_20px_rgba(169,207,70,0.4)]">
              Most Popular
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(169,207,70,0.3)]">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Tournament License</h3>
                  <p className="text-sm text-muted-foreground">Everything you need</p>
                </div>
              </div>

              <div className="mb-6">
                <span className="text-5xl font-bold">$29</span>
                <span className="text-muted-foreground ml-2">one-time</span>
              </div>

              <div className="bg-background/60 backdrop-blur-sm rounded-lg p-4 mb-6 border border-primary/20">
                <div className="flex items-center gap-2 text-sm">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span>Includes up to <strong className="text-primary">3 divisions</strong></span>
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {FEATURES.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={onGetStarted || (() => navigate("/tournaments/new"))}
                className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90 shadow-[0_0_25px_rgba(169,207,70,0.4)] transition-all hover:shadow-[0_0_35px_rgba(169,207,70,0.5)]"
                size="lg"
              >
                Create Tournament
              </Button>
            </div>
          </motion.div>

          {/* Additional Divisions Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            whileHover={{ y: -4 }}
            className="bg-gradient-to-br from-card to-muted/30 border border-border/50 rounded-2xl p-8 hover:border-primary/30 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-muted rounded-xl flex items-center justify-center">
                <Layers className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Additional Divisions</h3>
                <p className="text-sm text-muted-foreground">Scale as needed</p>
              </div>
            </div>

            <div className="mb-6">
              <span className="text-5xl font-bold">$9</span>
              <span className="text-muted-foreground ml-2">per division</span>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 mb-6 border border-border/50">
              <p className="text-sm text-muted-foreground">
                Need more than 3 divisions? Add as many as you need at $9 each.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm p-3 bg-muted/50 rounded-lg border border-border/50">
                <span className="text-foreground">4 divisions</span>
                <span className="font-semibold text-primary">$38 total</span>
              </div>
              <div className="flex justify-between text-sm p-3 bg-muted/50 rounded-lg border border-border/50">
                <span className="text-foreground">6 divisions</span>
                <span className="font-semibold text-primary">$56 total</span>
              </div>
              <div className="flex justify-between text-sm p-3 bg-muted/50 rounded-lg border border-border/50">
                <span className="text-foreground">10 divisions</span>
                <span className="font-semibold text-primary">$92 total</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
