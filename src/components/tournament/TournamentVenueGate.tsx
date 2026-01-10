import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Plus, Search, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUserVenueMemberships, type VenueMembership } from "@/hooks/useUserVenueMemberships";
import { cn } from "@/lib/utils";

interface TournamentVenueGateProps {
  onVenueSelect: (venueId: string) => void;
}

export function TournamentVenueGate({ onVenueSelect }: TournamentVenueGateProps) {
  const navigate = useNavigate();
  const { data: memberships, isLoading, error } = useUserVenueMemberships();
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your venues...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="max-w-md mx-auto">
        <CardContent className="pt-6 text-center">
          <p className="text-destructive">Failed to load your venues. Please try again.</p>
          <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No venues - show gating screen
  if (!memberships || memberships.length === 0) {
    return <NoVenuesGate navigate={navigate} />;
  }

  // One venue - auto-select and proceed
  if (memberships.length === 1) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h2 className="text-xl font-semibold mb-4">Creating tournament for</h2>
        <VenueCard venue={memberships[0]} selected onClick={() => onVenueSelect(memberships[0].venueId)} />
        <Button 
          onClick={() => onVenueSelect(memberships[0].venueId)} 
          className="mt-6"
          size="lg"
        >
          Continue
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </motion.div>
    );
  }

  // Multiple venues - show selector
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Select a Venue</h2>
        <p className="text-muted-foreground">
          Choose which venue will host this tournament
        </p>
      </div>

      <div className="grid gap-3 max-w-xl mx-auto">
        {memberships.map((venue) => (
          <VenueCard
            key={venue.venueId}
            venue={venue}
            selected={selectedVenueId === venue.venueId}
            onClick={() => setSelectedVenueId(venue.venueId)}
          />
        ))}
      </div>

      <div className="flex justify-center pt-4">
        <Button
          onClick={() => selectedVenueId && onVenueSelect(selectedVenueId)}
          disabled={!selectedVenueId}
          size="lg"
        >
          Continue with Selected Venue
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}

function NoVenuesGate({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-lg mx-auto"
    >
      <Card className="text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">You need a Venue to host tournaments</CardTitle>
          <CardDescription className="text-base">
            Tournaments on PULSE are hosted by venues. Create your free venue profile to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={() => navigate("/venue/create-fast")}
            size="lg"
            className="w-full"
          >
            <Plus className="mr-2 h-5 w-5" />
            Create a Free Venue Profile
          </Button>
          <Button
            onClick={() => navigate("/venues")}
            variant="outline"
            size="lg"
            className="w-full"
          >
            <Search className="mr-2 h-5 w-5" />
            Browse Venues
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function VenueCard({ 
  venue, 
  selected, 
  onClick 
}: { 
  venue: VenueMembership; 
  selected: boolean; 
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/50"
      )}
    >
      <Avatar className="h-12 w-12">
        <AvatarImage src={venue.logoUrl || undefined} alt={venue.venueName} />
        <AvatarFallback className="bg-muted">
          <Building2 className="h-6 w-6 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{venue.venueName}</p>
        {(venue.city || venue.state) && (
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {[venue.city, venue.state].filter(Boolean).join(", ")}
          </p>
        )}
      </div>
      <span className={cn(
        "text-xs font-medium px-2 py-1 rounded-full",
        venue.role === "owner" 
          ? "bg-primary/10 text-primary" 
          : "bg-muted text-muted-foreground"
      )}>
        {venue.role}
      </span>
    </button>
  );
}
