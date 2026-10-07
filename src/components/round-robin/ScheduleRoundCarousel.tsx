import { useState, useEffect, useId } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import "./event.css";

interface ScheduleRoundCarouselProps {
  totalRounds: number;
  /** Saved round numbers, including gaps after historical schedule changes. */
  roundNumbers?: number[];
  currentRound?: number;
  liveRound?: number;
  /** Optional action rendered to the right of the round selector (e.g. Edit schedule). */
  rightAction?: React.ReactNode;
  children: (roundNo: number, isActive: boolean) => React.ReactNode;
}

export function ScheduleRoundCarousel({
  totalRounds,
  roundNumbers,
  currentRound = 1,
  liveRound,
  rightAction,
  children,
}: ScheduleRoundCarouselProps) {
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const roundSelectId = useId();
  const rounds = roundNumbers ?? Array.from({ length: totalRounds }, (_, i) => i + 1);
  const matchingIndex = rounds.findIndex(round => round >= currentRound);
  const startIndex = Math.max(0, matchingIndex < 0 ? rounds.length - 1 : matchingIndex);
  const [selectedSlide, setCurrentSlide] = useState(startIndex);
  const currentSlide = Math.max(0, Math.min(selectedSlide, rounds.length - 1));
  const reducedMotion = useReducedMotion();

  // Track current slide
  useEffect(() => {
    if (!carouselApi) return;

    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap());
    };

    carouselApi.on("select", onSelect);
    carouselApi.on("reInit", onSelect);
    onSelect(); // Initial call
    
    return () => {
      carouselApi.off("select", onSelect);
      carouselApi.off("reInit", onSelect);
    };
  }, [carouselApi]);

  // Auto-scroll to current round on mount
  useEffect(() => {
    if (carouselApi && currentRound && currentRound > 0) {
      // Scroll to current round (0-indexed)
      carouselApi.scrollTo(startIndex, !!reducedMotion);
    }
  }, [carouselApi, currentRound, startIndex, reducedMotion]);

  if (rounds.length === 0) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: reducedMotion ? 0 : 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {/* Compact Round selector with optional inline action (e.g. Edit schedule) */}
      <div className="rr-round-toolbar">
        <div className="rr-round-switcher">
          <button
            onClick={() => carouselApi?.scrollPrev(!!reducedMotion)}
            disabled={currentSlide === 0}
            className="h-11 w-11 inline-flex items-center justify-center rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Previous round"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-sm font-semibold text-foreground px-1 text-center">
            <label htmlFor={roundSelectId} className="sr-only">Choose round</label>
            <select id={roundSelectId} aria-label="Choose round" value={rounds[currentSlide]} onChange={event => carouselApi?.scrollTo(rounds.indexOf(Number(event.target.value)), !!reducedMotion)} className="min-h-11 max-w-full rounded-lg bg-transparent px-2 font-semibold focus-visible:outline-primary">
              {rounds.map(round => <option key={round} value={round}>Round {round}{round === liveRound ? ' · Current' : ''}</option>)}
            </select>
            <span className="sr-only" aria-live="polite" aria-atomic="true">Round {rounds[currentSlide]}, {currentSlide + 1} of {rounds.length}</span>
          </div>
          <button
            onClick={() => carouselApi?.scrollNext(!!reducedMotion)}
            disabled={currentSlide === rounds.length - 1}
            className="h-11 w-11 inline-flex items-center justify-center rounded-full hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors focus-visible:ring-2 focus-visible:ring-primary"
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
        opts={{ align: "start", loop: false, startIndex }}
        className="rr-schedule-carousel w-full"
      >
        <CarouselContent className="-ml-0">
          {rounds.map((roundNo, index) => (
            <CarouselItem key={roundNo} className="pl-0" aria-label={`Round ${roundNo}`} aria-hidden={index !== currentSlide} {...(index !== currentSlide ? { inert: "" } : {})}>
              {/* Keep every slide for swipe geometry, but only mount nearby cards. */}
              {Math.abs(index - currentSlide) <= 1 && <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                {children(roundNo, index === currentSlide)}
              </motion.div>}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </motion.div>
  );
}
