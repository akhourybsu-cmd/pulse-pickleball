import { Calendar, MapPin, DollarSign, Trophy, Users, Clock } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { motion } from "framer-motion";
import CountUp from "react-countup";

interface TournamentEvent {
  location: string;
  start_date: string;
  end_date: string;
  registration_fee: number;
  registration_close_date: string | null;
  divisions?: Array<{
    id: string;
    format: string;
    max_teams: number | null;
  }>;
}

interface TournamentQuickFactsProps {
  event: TournamentEvent;
  registeredCount?: number;
  totalSpots?: number;
}

export function TournamentQuickFacts({ 
  event, 
  registeredCount = 0, 
  totalSpots 
}: TournamentQuickFactsProps) {
  const closeDate = event.registration_close_date ? new Date(event.registration_close_date) : null;
  const daysUntilClose = closeDate ? differenceInDays(closeDate, new Date()) : null;
  
  const format_type = event.divisions?.[0]?.format || "Round Robin";
  
  // Calculate total spots from divisions
  const calculatedTotalSpots = totalSpots || event.divisions?.reduce((acc, div) => {
    return acc + (div.max_teams || 16);
  }, 0) || 48;
  
  const fillPercentage = (registeredCount / calculatedTotalSpots) * 100;
  const isAlmostFull = fillPercentage > 75;

  const facts = [
    {
      icon: Calendar,
      value: format(new Date(event.start_date), "MMM d"),
      label: "Start Date",
      subtext: format(new Date(event.end_date), "MMM d, yyyy"),
    },
    {
      icon: MapPin,
      value: event.location.split(",")[0],
      label: "Location",
      subtext: event.location.split(",").slice(1).join(",").trim() || undefined,
    },
    {
      icon: DollarSign,
      value: event.registration_fee > 0 ? `$${event.registration_fee}` : "Free",
      label: "Entry Fee",
      subtext: "Per team",
    },
    {
      icon: Trophy,
      value: format_type,
      label: "Format",
      subtext: event.divisions?.length ? `${event.divisions.length} divisions` : undefined,
    },
    {
      icon: Users,
      value: registeredCount > 0 ? registeredCount : "—",
      label: "Registered",
      subtext: isAlmostFull ? "Almost Full!" : `of ${calculatedTotalSpots} spots`,
      highlight: isAlmostFull,
      isCountUp: registeredCount > 0,
    },
  ];

  // Add deadline if exists and not passed
  if (daysUntilClose !== null && daysUntilClose > 0) {
    facts.push({
      icon: Clock,
      value: `${daysUntilClose}d`,
      label: "Deadline",
      subtext: format(closeDate!, "MMM d"),
      highlight: daysUntilClose <= 7,
      isCountUp: false,
    });
  }

  return (
    <section className="py-12 md:py-16 bg-card border-y border-border">
      <div className="container mx-auto px-4">
        <div className="flex overflow-x-auto pb-4 md:pb-0 md:grid md:grid-cols-5 lg:grid-cols-6 gap-4 md:gap-6 snap-x snap-mandatory scrollbar-hide">
          {facts.map((fact, index) => (
            <motion.div
              key={fact.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.05 }}
              className={`flex-shrink-0 w-[140px] md:w-auto snap-start flex flex-col items-center text-center p-4 rounded-xl ${
                fact.highlight 
                  ? "bg-primary/10 border border-primary/20" 
                  : "bg-muted/50"
              }`}
            >
              <fact.icon className={`h-6 w-6 mb-3 ${
                fact.highlight ? "text-primary" : "text-muted-foreground"
              }`} />
              <div className={`text-2xl md:text-3xl font-bold ${
                fact.highlight ? "text-primary" : "text-foreground"
              }`}>
                {fact.isCountUp && typeof fact.value === "number" ? (
                  <CountUp end={fact.value} duration={1.5} />
                ) : (
                  fact.value
                )}
              </div>
              <div className="text-sm text-muted-foreground mt-1">{fact.label}</div>
              {fact.subtext && (
                <div className={`text-xs mt-0.5 ${
                  fact.highlight ? "text-primary font-medium" : "text-muted-foreground/70"
                }`}>
                  {fact.subtext}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
