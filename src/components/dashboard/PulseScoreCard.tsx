import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, Users, Swords, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PulseScoreBadge } from "@/components/profile/PulseScoreBadge";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useState, useEffect } from "react";

interface PartnerOpponentData {
  playerId: string;
  playerName: string;
  matchCount: number;
}

interface PulseScoreCardProps {
  currentRating: number | null | undefined;
  weeklyChange: number;
  userId: string | undefined;
  wins?: number;
  losses?: number;
  totalMatches?: number;
  pointsFor?: number;
  pointsAgainst?: number;
  avgOpponentRating?: number;
  mostPlayedPartner?: PartnerOpponentData | null;
  mostFacedOpponent?: PartnerOpponentData | null;
}

export const PulseScoreCard = ({ 
  currentRating, 
  weeklyChange, 
  userId,
  wins = 0,
  losses = 0,
  totalMatches = 0,
  pointsFor = 0,
  pointsAgainst = 0,
  avgOpponentRating = 3.0,
  mostPlayedPartner,
  mostFacedOpponent
}: PulseScoreCardProps) => {
  const navigate = useNavigate();
  const rating = currentRating ?? 3.0;
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap());

    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  const getTrendIcon = () => {
    if (weeklyChange > 0.01) return <TrendingUp className="w-4 h-4 text-primary" />;
    if (weeklyChange < -0.01) return <TrendingDown className="w-4 h-4 text-destructive" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (weeklyChange > 0.01) return "text-primary";
    if (weeklyChange < -0.01) return "text-destructive";
    return "text-muted-foreground";
  };

  const winRate = totalMatches > 0 ? ((wins / totalMatches) * 100).toFixed(1) : "0.0";
  const pointDiff = pointsFor - pointsAgainst;

  // Slide content components
  const slides = [
    // Slide 1: Pulse Score
    <div key="pulse" className="flex items-center justify-between w-full">
      <div className="flex flex-col">
        <motion.span 
          className="text-5xl md:text-6xl font-bold text-primary pulse-score-number"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {rating.toFixed(2)}
        </motion.span>
        <div className="flex items-center gap-2 mt-2">
          {getTrendIcon()}
          <span className={`text-sm font-medium ${getTrendColor()}`}>
            {weeklyChange > 0 ? "+" : ""}{weeklyChange.toFixed(2)} this week
          </span>
        </div>
        <div className="mt-2">
          <PulseScoreBadge score={rating} />
        </div>
      </div>
      <motion.svg 
        className="ecg-pulse flex-shrink-0" 
        width="80" 
        height="32" 
        viewBox="0 0 80 24"
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <path 
          d="M0 12 L20 12 L25 4 L30 20 L35 12 L80 12" 
          stroke="hsl(var(--primary))" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          pathLength="100"
        />
      </motion.svg>
    </div>,

    // Slide 2: Record & Win Rate
    <div key="record" className="flex items-center justify-between w-full">
      <div className="flex flex-col">
        <span className="text-sm text-muted-foreground font-medium mb-1">Record</span>
        <div className="flex items-baseline gap-2">
          <span className="text-4xl md:text-5xl font-bold text-foreground">{wins}</span>
          <span className="text-2xl text-muted-foreground">-</span>
          <span className="text-4xl md:text-5xl font-bold text-foreground">{losses}</span>
        </div>
        <span className="text-sm text-muted-foreground mt-1">{totalMatches} matches played</span>
      </div>
      <div className="flex flex-col items-center">
        <div className="relative w-20 h-20">
          <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="hsl(var(--muted))"
              strokeWidth="3"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="3"
              strokeDasharray={`${parseFloat(winRate)}, 100`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-bold text-foreground">{winRate}%</span>
          </div>
        </div>
        <span className="text-xs text-muted-foreground mt-1">Win Rate</span>
      </div>
    </div>,

    // Slide 3: Point Differential
    <div key="points" className="flex items-center justify-between w-full">
      <div className="flex flex-col flex-1">
        <span className="text-sm text-muted-foreground font-medium mb-2">Points</span>
        <div className="flex gap-6">
          <div className="flex flex-col">
            <span className="text-3xl md:text-4xl font-bold text-primary">{pointsFor}</span>
            <span className="text-xs text-muted-foreground">scored</span>
          </div>
          <div className="flex flex-col">
            <span className="text-3xl md:text-4xl font-bold text-muted-foreground">{pointsAgainst}</span>
            <span className="text-xs text-muted-foreground">against</span>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center">
        <span className={`text-3xl md:text-4xl font-bold ${pointDiff >= 0 ? 'text-primary' : 'text-destructive'}`}>
          {pointDiff >= 0 ? '+' : ''}{pointDiff}
        </span>
        <span className="text-xs text-muted-foreground">differential</span>
      </div>
    </div>,

    // Slide 4: Most Played Partner
    <div key="partner" className="flex items-center gap-4 w-full">
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Users className="w-6 h-6 text-primary" />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-sm text-muted-foreground font-medium">Most Played Partner</span>
        {mostPlayedPartner ? (
          <>
            <span className="text-xl font-bold text-foreground truncate">{mostPlayedPartner.playerName}</span>
            <span className="text-sm text-muted-foreground">{mostPlayedPartner.matchCount} matches together</span>
          </>
        ) : (
          <span className="text-lg text-muted-foreground">Play more to see stats</span>
        )}
      </div>
    </div>,

    // Slide 5: Most Faced Opponent
    <div key="opponent" className="flex items-center gap-4 w-full">
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
        <Swords className="w-6 h-6 text-destructive" />
      </div>
      <div className="flex flex-col flex-1 min-w-0">
        <span className="text-sm text-muted-foreground font-medium">Most Faced Opponent</span>
        {mostFacedOpponent ? (
          <>
            <span className="text-xl font-bold text-foreground truncate">{mostFacedOpponent.playerName}</span>
            <span className="text-sm text-muted-foreground">{mostFacedOpponent.matchCount} matches against</span>
          </>
        ) : (
          <span className="text-lg text-muted-foreground">Play more to see stats</span>
        )}
      </div>
    </div>,

    // Slide 6: Competition Level
    <div key="competition" className="flex items-center gap-4 w-full">
      <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
        <BarChart3 className="w-6 h-6 text-foreground" />
      </div>
      <div className="flex flex-col flex-1">
        <span className="text-sm text-muted-foreground font-medium">Avg Competition Level</span>
        <span className="text-3xl font-bold text-foreground">{avgOpponentRating.toFixed(2)}</span>
        <span className="text-sm text-muted-foreground">
          {avgOpponentRating >= rating ? "You play up!" : "Room to challenge yourself"}
        </span>
      </div>
    </div>,
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card 
        className="cursor-pointer hover:shadow-lg transition-all bg-gradient-to-br from-primary/5 via-background to-secondary/10 border-l-4 border-l-primary pulse-score-focal overflow-hidden"
        onClick={() => userId && navigate(`/profile/${userId}`)}
        data-tour="pulse-score"
      >
        <CardContent className="p-0">
          <Carousel
            setApi={setApi}
            opts={{
              align: "start",
              loop: true,
            }}
            className="w-full"
          >
            <CarouselContent className="-ml-0">
              {slides.map((slide, index) => (
                <CarouselItem key={index} className="pl-0">
                  <div className="p-6 md:p-8 min-h-[140px] flex items-center">
                    {slide}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </Carousel>
          
          {/* Dot pagination */}
          <div className="flex justify-center gap-1.5 pb-4">
            {Array.from({ length: count }).map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === current 
                    ? 'bg-primary w-4' 
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  api?.scrollTo(index);
                }}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};
