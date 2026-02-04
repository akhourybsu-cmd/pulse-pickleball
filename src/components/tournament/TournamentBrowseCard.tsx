import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import type { BrowseTournament } from "@/hooks/useBrowseTournaments";
import { getRegistrationStatus } from "@/hooks/useBrowseTournaments";

interface TournamentBrowseCardProps {
  tournament: BrowseTournament;
  index?: number;
}

export function TournamentBrowseCard({ tournament, index = 0 }: TournamentBrowseCardProps) {
  const navigate = useNavigate();
  const regStatus = getRegistrationStatus(tournament);

  const getRegistrationBadge = () => {
    switch (regStatus) {
      case 'open':
        return <Badge className="bg-green-600 text-white shadow-[0_0_6px_rgba(34,197,94,0.6)]">Open</Badge>;
      case 'opening_soon':
        return (
          <Badge variant="secondary">
            Opens {tournament.registration_open_date 
              ? format(new Date(tournament.registration_open_date), "MMM d") 
              : "Soon"}
          </Badge>
        );
      case 'closed':
        return <Badge variant="outline">Closed</Badge>;
    }
  };

  const displayLocation = tournament.venue_city && tournament.venue_state
    ? `${tournament.venue_city}, ${tournament.venue_state}`
    : tournament.location || "TBD";

  const tournamentPath = tournament.slug 
    ? `/tournament/${tournament.slug}` 
    : `/tournament/${tournament.id}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      whileHover={{ 
        y: -4,
        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.1), 0 0 18px rgba(197, 232, 108, 0.45)"
      }}
      viewport={{ once: true }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="border border-primary/30 rounded-2xl shadow-[0_4px_10px_rgba(0,0,0,0.05),0_0_12px_rgba(197,232,108,0.25)] bg-card hover:border-primary/50 transition-all duration-300 h-full group"
    >
      <Card className="border-0 shadow-none bg-transparent h-full">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2 mb-2">
            <CardTitle className="text-lg group-hover:text-primary transition-colors line-clamp-2">
              {tournament.name}
            </CardTitle>
            {getRegistrationBadge()}
          </div>
          <CardDescription className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
              <Calendar className="h-4 w-4 text-primary/60 shrink-0" />
              <span>
                {format(new Date(tournament.start_date), "MMM d")} - {format(new Date(tournament.end_date), "MMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
              <MapPin className="h-4 w-4 text-primary/60 shrink-0" />
              <span className="line-clamp-1">{displayLocation}</span>
            </div>
            <div className="flex items-center gap-4">
              {tournament.divisions_count > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground/80">
                  <Users className="h-4 w-4 text-primary/60" />
                  <span>{tournament.divisions_count} {tournament.divisions_count === 1 ? "Division" : "Divisions"}</span>
                </div>
              )}
              {tournament.registration_fee > 0 && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground/80">
                  <DollarSign className="h-4 w-4 text-primary/60" />
                  <span>${tournament.registration_fee}</span>
                </div>
              )}
            </div>
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {tournament.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
              {tournament.description}
            </p>
          )}
          
          <div className="flex gap-2">
            {regStatus === 'open' ? (
              <Button 
                className="flex-1 hover:shadow-[0_0_15px_rgba(197,232,108,0.5)] hover:scale-[1.02] transition-all duration-200"
                onClick={() => navigate(`/tournament/${tournament.id}/register`)}
              >
                Register
              </Button>
            ) : (
              <Button 
                className="flex-1"
                onClick={() => navigate(tournamentPath)}
              >
                View Details
              </Button>
            )}
            {regStatus === 'open' && (
              <Button 
                variant="outline"
                className="hover:bg-primary hover:text-primary-foreground transition-all duration-200"
                onClick={() => navigate(tournamentPath)}
              >
                Info
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
