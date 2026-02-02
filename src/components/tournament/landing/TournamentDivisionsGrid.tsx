import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { formatTournamentLabel } from "@/lib/formatLabels";

interface Division {
  id: string;
  name: string;
  format: string;
  max_teams: number | null;
  description: string | null;
  registered_count?: number;
}

interface TournamentDivisionsGridProps {
  divisions: Division[];
  eventId: string;
}

export function TournamentDivisionsGrid({ divisions, eventId }: TournamentDivisionsGridProps) {
  const navigate = useNavigate();

  if (!divisions || divisions.length === 0) return null;

  return (
    <section className="py-12 md:py-24 px-4 bg-muted/30">
      <div className="container mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8 md:mb-12"
        >
          <h2 className="text-2xl md:text-4xl font-bold text-foreground mb-2 md:mb-3">
            Choose Your Division
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Select the division that matches your skill level and format preference
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {divisions.map((division, index) => {
            const maxTeams = division.max_teams || 16;
            const registeredCount = division.registered_count || 0;
            const fillPercentage = (registeredCount / maxTeams) * 100;
            const spotsLeft = maxTeams - registeredCount;
            const isAlmostFull = fillPercentage > 75;
            const isFull = fillPercentage >= 100;

            return (
              <motion.div
                key={division.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
              >
                <Card className={`h-full group hover:shadow-xl transition-all duration-300 ${
                  isFull 
                    ? "border-muted opacity-75" 
                    : isAlmostFull 
                    ? "border-orange-400/50 hover:border-orange-400 hover:shadow-orange-400/20" 
                    : "hover:border-primary hover:shadow-primary/20"
                }`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-xl">{division.name}</CardTitle>
                      <Badge 
                        variant="secondary" 
                        className="shrink-0 text-xs"
                      >
                        {formatTournamentLabel(division.format)}
                      </Badge>
                    </div>
                    {division.description && (
                      <CardDescription className="mt-2">
                        {division.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Registration Progress */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5">
                          <Users className="h-4 w-4" />
                          Teams Registered
                        </span>
                        <span className={`font-medium ${
                          isFull ? "text-muted-foreground" : isAlmostFull ? "text-orange-500" : "text-foreground"
                        }`}>
                          {registeredCount}/{maxTeams}
                        </span>
                      </div>
                      <Progress 
                        value={fillPercentage} 
                        className={`h-2 ${
                          isFull 
                            ? "[&>div]:bg-muted-foreground" 
                            : isAlmostFull 
                            ? "[&>div]:bg-orange-500" 
                            : "[&>div]:bg-primary"
                        }`}
                      />
                      {!isFull && spotsLeft <= 5 && (
                        <p className={`text-xs font-medium ${
                          isAlmostFull ? "text-orange-500" : "text-primary"
                        }`}>
                          Only {spotsLeft} {spotsLeft === 1 ? "spot" : "spots"} left!
                        </p>
                      )}
                    </div>

                    {/* Register Button */}
                    <Button
                      className={`w-full group/btn ${
                        isFull 
                          ? "bg-muted text-muted-foreground cursor-not-allowed" 
                          : "hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02] transition-all"
                      }`}
                      disabled={isFull}
                      onClick={() => navigate(`/tournament/${eventId}/register?division=${division.id}`)}
                    >
                      {isFull ? "Division Full" : (
                        <>
                          Register for This Division
                          <ChevronRight className="h-4 w-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
