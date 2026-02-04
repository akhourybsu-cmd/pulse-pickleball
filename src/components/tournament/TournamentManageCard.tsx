import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, MapPin, Users, Edit, Eye, Palette, MoreVertical } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Tournament {
  id: string;
  name: string;
  location: string | null;
  start_date: string;
  end_date: string;
  status: string;
  divisions_count: number;
  public_view_enabled: boolean;
  slug: string | null;
}

interface TournamentManageCardProps {
  tournament: Tournament;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  draft: { label: "Draft", variant: "secondary" },
  upcoming: { label: "Upcoming", variant: "default" },
  live: { label: "Live", variant: "default" },
  completed: { label: "Completed", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function TournamentManageCard({ tournament }: TournamentManageCardProps) {
  const navigate = useNavigate();
  const statusInfo = statusConfig[tournament.status] || statusConfig.draft;

  const publicUrl = tournament.slug 
    ? `/tournament/${tournament.slug}` 
    : `/tournament/${tournament.id}`;

  return (
    <Card className="h-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2">{tournament.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/tournaments/${tournament.id}`)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Tournament
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate(`/tournaments/${tournament.id}/customize`)}>
                  <Palette className="h-4 w-4 mr-2" />
                  Customize Landing
                </DropdownMenuItem>
                {tournament.public_view_enabled && (
                  <DropdownMenuItem onClick={() => navigate(publicUrl)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Public Page
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CardDescription className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
            <span>
              {format(new Date(tournament.start_date), "MMM d")} - {format(new Date(tournament.end_date), "MMM d, yyyy")}
            </span>
          </div>
          {tournament.location && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="line-clamp-1">{tournament.location}</span>
            </div>
          )}
          {tournament.divisions_count > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span>{tournament.divisions_count} {tournament.divisions_count === 1 ? "Division" : "Divisions"}</span>
            </div>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => navigate(`/tournaments/${tournament.id}`)}
          >
            <Edit className="h-4 w-4 mr-2" />
            Manage
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate(`/tournaments/${tournament.id}/customize`)}
          >
            <Palette className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
