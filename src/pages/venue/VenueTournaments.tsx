import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trophy, Calendar, MapPin, ExternalLink, Eye, EyeOff, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useMode } from "@/contexts/ModeContext";
import { useVenueTournaments, type VenueTournament } from "@/hooks/useVenueTournaments";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  upcoming: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  live: "bg-green-500/10 text-green-600 dark:text-green-400",
  completed: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const visibilityIcons: Record<string, typeof Eye> = {
  public: Eye,
  unlisted: EyeOff,
  private: EyeOff,
};

export default function VenueTournaments() {
  const navigate = useNavigate();
  const { currentVenue } = useMode();
  const venueId = currentVenue?.venue_id || null;
  const { tournaments, isLoading, updateTournament } = useVenueTournaments(venueId);

  const handleCreateTournament = () => {
    if (venueId) {
      navigate(`/venue/tournaments/new?venueId=${venueId}`);
    }
  };

  const handleViewTournament = (tournament: VenueTournament) => {
    navigate(`/tournaments/${tournament.id}`);
  };

  const handleToggleStatus = async (tournament: VenueTournament) => {
    const newStatus = tournament.status === "draft" ? "upcoming" : "draft";
    await updateTournament({
      tournamentId: tournament.id,
      updates: { status: newStatus },
    });
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tournaments</h1>
          <p className="text-muted-foreground">
            Create and manage your venue's tournaments
          </p>
        </div>
        <Button onClick={handleCreateTournament} className="gap-2">
          <Plus className="h-4 w-4" />
          Create Tournament
        </Button>
      </div>

      {/* Tournament List */}
      {tournaments.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle className="mb-2">No tournaments yet</CardTitle>
            <CardDescription className="mb-6">
              Create your first tournament to start attracting players
            </CardDescription>
            <Button onClick={handleCreateTournament} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Your First Tournament
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {tournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              onView={() => handleViewTournament(tournament)}
              onToggleStatus={() => handleToggleStatus(tournament)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TournamentCard({
  tournament,
  onView,
  onToggleStatus,
}: {
  tournament: VenueTournament;
  onView: () => void;
  onToggleStatus: () => void;
}) {
  const VisibilityIcon = visibilityIcons[tournament.visibility] || Eye;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold truncate">{tournament.name}</h3>
              <Badge className={cn("text-xs", statusColors[tournament.status])}>
                {tournament.status}
              </Badge>
              <VisibilityIcon className="h-4 w-4 text-muted-foreground" />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {tournament.start_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(tournament.start_date), "MMM d, yyyy")}
                  {tournament.end_date && tournament.end_date !== tournament.start_date && (
                    <> - {format(new Date(tournament.end_date), "MMM d, yyyy")}</>
                  )}
                </span>
              )}
              {tournament.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {tournament.location}
                </span>
              )}
              {tournament.divisions_count !== null && tournament.divisions_count > 0 && (
                <span>{tournament.divisions_count} division{tournament.divisions_count !== 1 ? "s" : ""}</span>
              )}
            </div>

            {tournament.external_registration_url && (
              <a
                href={tournament.external_registration_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
              >
                <ExternalLink className="h-3 w-3" />
                External Registration
              </a>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onView}>
              View
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onView}>
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onToggleStatus}>
                  {tournament.status === "draft" ? "Publish" : "Unpublish"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
