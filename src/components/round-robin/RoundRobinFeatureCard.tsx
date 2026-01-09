import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface RoundRobinFeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index: number;
}

export const RoundRobinFeatureCard = ({ 
  icon: Icon, 
  title, 
  description, 
  index 
}: RoundRobinFeatureCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      whileHover={{ y: -6, scale: 1.02 }}
      className="group relative"
    >
      <div className="relative bg-card border border-border/60 rounded-2xl p-6 h-full overflow-hidden transition-all duration-300 hover:border-primary/40 hover:shadow-[0_8px_30px_rgba(169,207,70,0.15)]">
        {/* Hover glow effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl" />
        
        {/* Icon container */}
        <div className="relative z-10 h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors duration-300">
          <Icon className="h-6 w-6 text-primary" />
        </div>
        
        {/* Content */}
        <div className="relative z-10 space-y-2">
          <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
            {title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  );
};
