import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, Building2, Trophy, ExternalLink, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type VenueRow = { id: string; name: string; slug: string | null };

/**
 * AdminArchive — single index page for all surfaces that have been
 * compartmentalized away from the player-facing app. Lives behind
 * AdminGuard. The underlying routes (/venue/*, /tournaments/*, etc.)
 * are themselves admin-gated, so this page is just discoverable
 * navigation for the people who still need to reach them.
 */
export default function AdminArchive() {
  const navigate = useNavigate();
  const [venues, setVenues] = useState<VenueRow[]>([]);

  useEffect(() => {
    supabase
      .from("venues")
      .select("id,name,slug")
      .order("name")
      .limit(50)
      .then(({ data }) => setVenues((data ?? []) as VenueRow[]));
  }, []);

  const ArchiveLink = ({ to, label }: { to: string; label: string }) => (
    <Link
      to={to}
      className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm hover:bg-accent transition"
    >
      <span>{label}</span>
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b bg-secondary/30">
        <div className="container max-w-4xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Archive className="h-5 w-5 text-muted-foreground" />
          <div>
            <h1 className="text-lg font-semibold">Archived Surfaces</h1>
            <p className="text-xs text-muted-foreground">
              Internal-only. Hidden from all non-admin users.
            </p>
          </div>
          <Badge variant="outline" className="ml-auto">Admin</Badge>
        </div>
      </div>

      <div className="container max-w-4xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Venues</CardTitle>
            </div>
            <CardDescription>
              Venue console, public landings, and onboarding. Not linked from anywhere in the player app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ArchiveLink to="/venue" label="Venue console (current workspace)" />
            <ArchiveLink to="/venues" label="Venues marketing landing" />
            <ArchiveLink to="/venue/create-fast" label="Create a venue" />
            <ArchiveLink to="/admin/venue-verification" label="Venue verification queue" />
            {venues.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Public landings ({venues.length})
                </p>
                <div className="grid gap-1.5">
                  {venues.map((v) => (
                    <ArchiveLink
                      key={v.id}
                      to={v.slug ? `/v/${v.slug}` : `/venue/${v.id}`}
                      label={v.name}
                    />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-primary" />
              <CardTitle>Tournaments</CardTitle>
            </div>
            <CardDescription>
              Tournament discovery, registration, live view, and admin tools.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <ArchiveLink to="/tournaments" label="Tournaments landing" />
            <ArchiveLink to="/tournaments/manage" label="Manage tournaments" />
            <ArchiveLink to="/tournament-admin" label="Tournament admin console" />
            <ArchiveLink to="/tournaments/new" label="Create a tournament" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
