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

export function PricingShowcase() {
  const navigate = useNavigate();

  return (
    <section className="py-16 px-4">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            One flat fee per tournament. No hidden costs. No recurring charges.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Tournament License Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/30 rounded-2xl p-8 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 bg-primary text-primary-foreground px-4 py-1 rounded-bl-xl text-sm font-medium">
              Most Popular
            </div>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
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

            <div className="bg-background/50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <Sparkles className="h-4 w-4 text-accent" />
                <span>Includes up to <strong>3 divisions</strong></span>
              </div>
            </div>

            <ul className="space-y-3 mb-8">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            <Button
              onClick={() => navigate("/tournaments/new")}
              className="w-full bg-gradient-to-r from-primary to-accent hover:opacity-90"
              size="lg"
            >
              Create Tournament
            </Button>
          </motion.div>

          {/* Additional Divisions Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="bg-card/50 border border-border/50 rounded-2xl p-8"
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

            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground">
                Need more than 3 divisions? Add as many as you need at $9 each.
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between text-sm p-3 bg-background/50 rounded-lg">
                <span>4 divisions</span>
                <span className="font-medium">$38 total</span>
              </div>
              <div className="flex justify-between text-sm p-3 bg-background/50 rounded-lg">
                <span>6 divisions</span>
                <span className="font-medium">$56 total</span>
              </div>
              <div className="flex justify-between text-sm p-3 bg-background/50 rounded-lg">
                <span>10 divisions</span>
                <span className="font-medium">$92 total</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
