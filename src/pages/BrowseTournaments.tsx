import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Search } from "lucide-react";
import { motion } from "framer-motion";
import { TournamentBrowseHeader } from "@/components/tournament/TournamentBrowseHeader";
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

  return (
    <div className="min-h-screen bg-[hsl(var(--page-bg))]">
      <TournamentBrowseHeader userId={userId} activeTab="browse" />
      
      {/* Compact Hero Section */}
      <section className="bg-secondary py-6 sm:py-8">
        <div className="container mx-auto px-4 max-w-4xl">
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="text-center"
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              <Trophy className="h-6 w-6 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold text-white">
                Find Tournaments
              </h1>
            </div>
            <p className="text-white/80 text-sm sm:text-base mb-4">
              Discover pickleball events near you
            </p>
            
            {/* Unified Search Bar */}
            <div className="relative max-w-xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Search by name, city, or state..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-12 text-base bg-background border-0 shadow-lg rounded-xl"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Filters & Tournaments Section */}
      <section className="py-4 sm:py-6 px-4 bg-background">
        <div className="container mx-auto max-w-6xl">
          {/* Compact Filter Bar */}
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-6"
          >
            <TournamentBrowseFilters
              dateRange={dateRange}
              registrationStatus={registrationStatus}
              onDateRangeChange={setDateRange}
              onRegistrationStatusChange={setRegistrationStatus}
              onClearFilters={handleClearFilters}
              hasActiveFilters={!!search || !!location || dateRange !== 'all' || registrationStatus !== 'all'}
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
