import { useState, useEffect } from "react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ScheduleRoundCarouselProps {
  totalRounds: number;
  currentRound?: number;
  children: (roundNo: number, isActive: boolean) => React.ReactNode;
}

export function ScheduleRoundCarousel({
  totalRounds,
  currentRound = 1,
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
    <div className="space-y-4">
      {/* Round Indicator & Navigation Dots */}
      <div className="flex items-center justify-center gap-4">
        <button
          onClick={() => carouselApi?.scrollPrev()}
          disabled={currentSlide === 0}
          className="p-1.5 rounded-full bg-muted hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous round"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            Round {currentSlide + 1} of {totalRounds}
          </span>
          
          {/* Dot indicators */}
          <div className="flex gap-1.5">
            {Array.from({ length: totalRounds }).map((_, i) => (
              <button
                key={i}
                onClick={() => carouselApi?.scrollTo(i)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  i === currentSlide
                    ? "bg-primary"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Go to round ${i + 1}`}
              />
            ))}
          </div>
        </div>

        <button
          onClick={() => carouselApi?.scrollNext()}
          disabled={currentSlide === totalRounds - 1}
          className="p-1.5 rounded-full bg-muted hover:bg-muted/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
              {children(roundNo, roundNo === currentSlide + 1)}
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
