import { motion } from "framer-motion";
import { Trophy, ArrowRight, Sparkles, ChevronDown, Shield, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface TournamentHeroProps {
  onCreateClick?: () => void;
}

export function TournamentHero({ onCreateClick }: TournamentHeroProps) {
  const navigate = useNavigate();

  return (
    <section className="relative overflow-hidden py-20 md:py-28 px-4 bg-gradient-to-br from-secondary via-secondary/95 to-secondary">
      {/* Animated background glow orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-1/4 -right-1/4 w-[700px] h-[700px] bg-primary/20 rounded-full blur-[120px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -bottom-1/4 -left-1/4 w-[600px] h-[600px] bg-accent/15 rounded-full blur-[100px]"
          animate={{
            scale: [1.1, 1, 1.1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[80px]"
          animate={{
            scale: [1, 1.15, 1],
            opacity: [0.2, 0.35, 0.2],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </div>

      <div className="max-w-5xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center"
        >
          {/* Premium Badge with pulse glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-primary/15 text-primary px-5 py-2.5 rounded-full mb-8 border border-primary/30 shadow-[0_0_20px_rgba(169,207,70,0.2)]"
          >
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold tracking-wide">Premium Tournament Platform</span>
          </motion.div>

          {/* Main heading with gradient accent */}
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight text-white"
          >
            Professional Pickleball
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-accent bg-clip-text text-transparent">
              Tournaments
            </span>
          </motion.h1>

          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10"
          >
            Join competitive events or host your own with automated brackets, live scoring,
            and seamless player registration. Everything you need in one place.
          </motion.p>

          {/* CTAs with glow effect */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
          >
            <Button
              onClick={onCreateClick || (() => navigate("/tournaments/new"))}
              size="lg"
              className="bg-gradient-to-r from-primary to-accent hover:opacity-90 gap-2 text-lg px-8 shadow-[0_0_30px_rgba(169,207,70,0.4)] transition-all hover:shadow-[0_0_40px_rgba(169,207,70,0.5)] text-primary-foreground"
            >
              <Trophy className="h-5 w-5" />
              Create Tournament
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate("/tournaments/browse")}
              className="gap-2 text-lg px-8 bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white hover:border-white/50"
            >
              Browse Tournaments
            </Button>
          </motion.div>

          {/* Features in elevated card */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-card/80 backdrop-blur-md border border-border/50 rounded-2xl p-6 md:p-8 max-w-xl mx-auto shadow-xl"
          >
            <div className="grid grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-2">
                  <Zap className="h-5 w-5 text-primary" />
                </div>
                <div className="text-sm font-medium text-foreground">Automated</div>
                <div className="text-xs text-muted-foreground">Brackets</div>
              </div>
              <div className="text-center border-x border-border/50">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="text-sm font-medium text-foreground">Live</div>
                <div className="text-xs text-muted-foreground">Scoring</div>
              </div>
              <div className="text-center">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center mx-auto mb-2">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div className="text-sm font-medium text-foreground">Secure</div>
                <div className="text-xs text-muted-foreground">Registration</div>
              </div>
            </div>
          </motion.div>

          {/* Scroll indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-12"
          >
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <ChevronDown className="h-6 w-6 mx-auto text-white/40" />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
