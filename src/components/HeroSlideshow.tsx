import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Trophy, Target, Users, TrendingUp } from "lucide-react";
import regionMap from "@/assets/region-map.png";

interface Slide {
  title: string;
  subtitle: string;
  icon?: React.ReactNode;
  image?: string;
  cta?: string;
}

const slides: Slide[] = [
  {
    title: "Your Community. Your Rankings.",
    subtitle: "PULSE is a community-driven platform designed for local pickleball players. See where you stack up among your fellow peers—not against national rankings like DUPR, but within the community you play and compete with every day.",
    cta: "Start Tracking Your Rating"
  },
  {
    title: "What is PULSE?",
    subtitle: "Pickleball Universal Level & Skill Estimator - A dynamic rating system that tracks your performance, updates weekly, and helps you measure your growth within your local pickleball community.",
    icon: <Target className="w-16 h-16 mx-auto mb-4 text-primary" />,
    cta: "Learn Your Rating"
  },
  {
    title: "Track Your Journey",
    subtitle: "View your personal dashboard with detailed stats, match history, rating progression charts, and earned badges. See your wins, losses, and how you compare to players in your community.",
    icon: <TrendingUp className="w-16 h-16 mx-auto mb-4 text-secondary" />,
    cta: "See Your Dashboard"
  },
  {
    title: "Built for Doubles Players",
    subtitle: "Our specialized rating algorithm considers team dynamics, partner synergy, and opponent strength to give you the most accurate doubles rating possible.",
    icon: <Users className="w-16 h-16 mx-auto mb-4 text-primary" />,
    cta: "Start Playing"
  },
  {
    title: "Your Local Community",
    subtitle: "PULSE is designed specifically for pickleball players in Southeastern Massachusetts and Rhode Island. Track your progress and compete within your regional community.",
    image: regionMap,
    cta: "Join Your Region"
  }
];

export const HeroSlideshow = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const interval = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentSlide((prev) => (prev + 1) % slides.length);
        setIsTransitioning(false);
      }, 500);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const slide = slides[currentSlide];

  return (
    <div className="relative min-h-[400px] flex items-center justify-center">
      <div
        className={`max-w-4xl mx-auto text-center transition-all duration-500 ${
          isTransitioning ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
        }`}
      >
        {slide.icon && <div className="mb-4">{slide.icon}</div>}
        {slide.image && (
          <div className="mb-6 flex justify-center">
            <img 
              src={slide.image} 
              alt="Regional map" 
              className="rounded-lg shadow-lg max-w-2xl w-full h-auto"
            />
          </div>
        )}
        
        <h2 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
          {slide.title}
        </h2>
        
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          {slide.subtitle}
        </p>
        
        <Button 
          size="lg" 
          onClick={() => navigate("/auth")} 
          className="shadow-[var(--shadow-glow)]"
        >
          {slide.cta || "Get Started"}
        </Button>

        {/* Slide indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => {
                setIsTransitioning(true);
                setTimeout(() => {
                  setCurrentSlide(index);
                  setIsTransitioning(false);
                }, 500);
              }}
              className={`h-2 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? "w-8 bg-primary" 
                  : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
