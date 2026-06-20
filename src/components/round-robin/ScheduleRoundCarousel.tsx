import { useState, useEffect } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface ScheduleRoundCarouselProps {
  totalRounds: number;
  currentRound?: number;
  /** Optional action rendered to the right of the round selector (e.g. Edit schedule). */
  rightAction?: React.ReactNode;
  children: (roundNo: number, isActive: boolean) => React.ReactNode;
}

export function ScheduleRoundCarousel({
  totalRounds,
  currentRound = 1,
  rightAction,
  children,
}: ScheduleRoundCarouselProps) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const [currentSlide, setCurrentSlide] = useState(0);

  // Track current slide
  useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };

    carouselApi.on("select", onSelect);
    onSelect(); // Initial call
    
    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  // Auto-scroll to current round on mount
  useEffect(() => {
    if (carouselApi && currentRound && currentRound > 0) {
      // Scroll to current round (0-indexed)
      carouselApi.scrollTo(currentRound - 1);
    }
  }, [carouselApi, currentRound]);

  if (totalRounds === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Premium Round Indicator & Navigation */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => carouselApi?.scrollPrev()}
          disabled={currentSlide === 0}
          className="p-2 rounded-full bg-card border border-border hover:bg-accent hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
          aria-label="Previous round"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        <div className="flex items-center gap-4 px-4 py-2 rounded-full bg-card/80 backdrop-blur-sm border border-border/50 shadow-sm">
          <span className="text-sm font-semibold text-foreground">
            Round {currentSlide + 1} <span className="text-muted-foreground font-normal">of {totalRounds}</span>
          </span>
          
          {/* Premium Dot indicators */}
          <div className="flex gap-2">
            {Array.from({ length: totalRounds }).map((_, i) => (
              <button
                key={i}
                onClick={() => carouselApi?.scrollTo(i)}
                className={`relative h-2.5 w-2.5 rounded-full transition-all duration-300 ${
                  i === currentSlide
                    ? "bg-primary shadow-[0_0_8px_rgba(197,232,108,0.6)] scale-110"
                    : i === currentRound - 1
                    ? "bg-primary/50 ring-1 ring-primary/30"
                    : "bg-muted-foreground/25 hover:bg-muted-foreground/40"
                }`}
                aria-label={`Go to round ${i + 1}`}
              >
                {i === currentSlide && (
                  <motion.span
                    layoutId="activeRoundIndicator"
                    className="absolute inset-0 rounded-full bg-primary"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => carouselApi?.scrollNext()}
          disabled={currentSlide === totalRounds - 1}
          className="p-2 rounded-full bg-card border border-border hover:bg-accent hover:border-primary/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
          aria-label="Next round"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Carousel */}
      <Carousel
        setApi={setCarouselApi}
        opts={{ align: "start", loop: false }}
        className="w-full"
      >
        <CarouselContent className="-ml-0">
          {Array.from({ length: totalRounds }, (_, i) => i + 1).map((roundNo) => (
            <CarouselItem key={roundNo} className="pl-0">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {children(roundNo, roundNo === currentSlide + 1)}
              </motion.div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </motion.div>
  );
}
