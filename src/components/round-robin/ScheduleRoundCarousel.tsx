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
      {/* Compact Round selector with optional inline action (e.g. Edit schedule) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 px-1 py-1 rounded-full bg-card border border-border/60 shadow-sm">
          <button
            onClick={() => carouselApi?.scrollPrev()}
            disabled={currentSlide === 0}
            className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous round"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold text-foreground px-2 min-w-[110px] text-center">
            Round {currentSlide + 1} <span className="text-muted-foreground font-normal">of {totalRounds}</span>
          </span>
          <button
            onClick={() => carouselApi?.scrollNext()}
            disabled={currentSlide === totalRounds - 1}
            className="p-1.5 rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next round"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {rightAction}
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
