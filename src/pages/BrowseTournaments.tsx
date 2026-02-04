import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, ChevronDown } from "lucide-react";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/PageHeader";
import { TournamentBrowseFilters } from "@/components/tournament/TournamentBrowseFilters";
import { TournamentBrowseCard } from "@/components/tournament/TournamentBrowseCard";
import { useBrowseTournaments } from "@/hooks/useBrowseTournaments";
import type { DateRangeFilter, RegistrationStatus } from "@/hooks/useBrowseTournaments";
import { useDebounce } from "@/hooks/useDebounce";

export default function BrowseTournaments() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [dateRange, setDateRange] = useState<DateRangeFilter>(
    (searchParams.get('dateRange') as DateRangeFilter) || 'all'
  );
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatus>(
    (searchParams.get('status') as RegistrationStatus) || 'all'
  );

  // Debounce search and location inputs
  const debouncedSearch = useDebounce(search, 300);
  const debouncedLocation = useDebounce(location, 300);

  // Fetch tournaments with filters
  const { tournaments, loading, error } = useBrowseTournaments({
    search: debouncedSearch,
    location: debouncedLocation,
    dateRange,
    registrationStatus,
  });

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();
  }, []);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (debouncedLocation) params.set('location', debouncedLocation);
    if (dateRange !== 'all') params.set('dateRange', dateRange);
    if (registrationStatus !== 'all') params.set('status', registrationStatus);
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, debouncedLocation, dateRange, registrationStatus, setSearchParams]);

  const handleClearFilters = () => {
    setSearch('');
    setLocation('');
    setDateRange('all');
    setRegistrationStatus('all');
  };

  const scrollToTournaments = () => {
    document.getElementById("tournaments-section")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--page-bg))]">
      <PageHeader userId={userId} />
      
      {/* Hero Section */}
      <section className="relative min-h-[280px] flex items-center justify-center overflow-hidden bg-secondary">
        <div className="absolute inset-0 bg-gradient-to-br from-secondary via-secondary/90 to-secondary/80" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="container mx-auto px-4 py-12 text-center relative z-10"
        >
          <Trophy className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-4 drop-shadow-lg">
            Find Your Next Tournament
          </h1>
          <p className="text-lg sm:text-xl text-white/90 mb-6 max-w-xl mx-auto drop-shadow">
            Discover pickleball tournaments in your area
          </p>
          
          <Button 
            size="lg" 
            variant="outline" 
            className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-secondary transition-all duration-300"
            onClick={scrollToTournaments}
          >
            Browse All
            <ChevronDown className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </section>

      {/* Filters & Tournaments Section */}
      <section id="tournaments-section" className="py-8 px-4 bg-background">
        <div className="container mx-auto max-w-6xl">
          {/* Filters */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-8"
          >
            <TournamentBrowseFilters
              search={search}
              location={location}
              dateRange={dateRange}
              registrationStatus={registrationStatus}
              onSearchChange={setSearch}
              onLocationChange={setLocation}
              onDateRangeChange={setDateRange}
              onRegistrationStatusChange={setRegistrationStatus}
              onClearFilters={handleClearFilters}
            />
          </motion.div>

          {/* Results count */}
          {!loading && (
            <p className="text-sm text-muted-foreground mb-4">
              {tournaments.length} {tournaments.length === 1 ? 'tournament' : 'tournaments'} found
            </p>
          )}
          
          {/* Loading state */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="rounded-2xl border p-6 space-y-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-destructive mb-4">Failed to load tournaments</p>
              <Button onClick={() => window.location.reload()}>Try Again</Button>
            </div>
          ) : tournaments.length === 0 ? (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-xl text-muted-foreground mb-2">
                No tournaments found
              </p>
              <p className="text-muted-foreground mb-6">
                Try adjusting your filters or check back later
              </p>
              <Button variant="outline" onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {tournaments.map((tournament, index) => (
                <TournamentBrowseCard 
                  key={tournament.id} 
                  tournament={tournament} 
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      {userId && (
        <section className="py-12 px-4 bg-secondary/10 text-center">
          <div className="container mx-auto max-w-xl">
            <h2 className="text-2xl font-bold mb-4">Hosting a Tournament?</h2>
            <p className="text-muted-foreground mb-6">
              Create and manage your own pickleball tournaments with Pulse
            </p>
            <Button onClick={() => navigate("/tournaments/manage")}>
              Manage My Tournaments
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
