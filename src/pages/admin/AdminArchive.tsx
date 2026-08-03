import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Archive, Trophy, ExternalLink, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * AdminArchive — single index page for all surfaces that have been
 * compartmentalized away from the player-facing app. Lives behind
 * AdminGuard. The underlying routes (/tournaments/*, etc.) are
 * themselves admin-gated, so this page is just discoverable
 * navigation for the people who still need to reach them.
 */
export default function AdminArchive() {
  const navigate = useNavigate();

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
