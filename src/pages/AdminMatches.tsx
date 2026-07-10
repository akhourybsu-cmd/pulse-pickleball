import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { resolveParticipantName } from "@/lib/matchDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Filter,
  Download,
  Edit,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { EditMatchSheet } from "@/components/admin/EditMatchSheet";
import { toLocaleDateStringEST } from "@/lib/utils";
import { AdminLayout } from "@/components/admin/AdminLayout";

interface MatchRow {
  match_id: string;
  match_date: string;
  created_at: string;
  team1_score: number;
  team2_score: number;
  court_name: string;
  other_location: string | null;
  event_name: string | null;
  event_id: string | null;
  round_number: string | null;
  event_court_number: number | null;
  match_type: string;
  rating_eligible: boolean;
  verified_count: number;
  created_by_name: string;
  players: string[];
  voided: boolean;
  void_reason: string | null;
}

const AdminMatches = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [filteredMatches, setFilteredMatches] = useState<MatchRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [verifiedFilter, setVerifiedFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [venueFilter, setVenueFilter] = useState("all");
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [matches, searchTerm, dateFilter, verifiedFilter, typeFilter, venueFilter]);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!(await isPlatformAdmin(user.id))) {
      toast.error("Unauthorized access");
      navigate("/dashboard");
      return;
    }

    await fetchMatches();
  };

  const fetchMatches = async () => {
    setLoading(true);

    const { data: matchesData, error } = await supabase
      .from("matches")
      .select(`
        id,
        match_date,
        created_at,
        team1_score,
        team2_score,
        court_id,
        other_location,
        event_id,
        round_number,
        event_court_number,
        match_type,
        verified_by,
        created_by,
        voided,
        void_reason,
        courts(name),
        events(name),
        profiles!matches_created_by_fkey(display_name, full_name)
      `)
      .order("match_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching matches:", error);
      toast.error("Failed to load matches");
      setLoading(false);
      return;
    }

    // One batched, guest-aware participant fetch for every match. The
    // previous version issued 2 queries PER MATCH and selected only
    // player_id — guest participants (player_id NULL, guest_player_id
    // set) resolved to zero profiles, so all-guest matches (round robins
    // with guests) rendered "no players" on the directory cards.
    const matchIds = (matchesData || []).map((m: any) => m.id);
    const namesByMatch = new Map<string, string[]>();
    if (matchIds.length > 0) {
      const { data: allParticipants, error: participantsError } = await supabase
        .from("match_participants")
        .select(`
          match_id,
          player_id,
          guest_player_id,
          profiles:profiles_public!match_participants_player_id_fkey(display_name, full_name),
          guest:guest_players!match_participants_guest_player_id_fkey(display_name, linked_user_id)
        `)
        .in("match_id", matchIds);

      if (participantsError) {
        console.error("Error fetching match participants:", participantsError);
      }

      for (const p of (allParticipants || []) as any[]) {
        const name = resolveParticipantName(p);
        const arr = namesByMatch.get(p.match_id) ?? [];
        arr.push(name);
        namesByMatch.set(p.match_id, arr);
      }
    }

    const matchRows: MatchRow[] = (matchesData || []).map((match: any) => {
        const playerNames = namesByMatch.get(match.id) ?? [];

        let courtName = "Unknown Location";
        if (match.other_location) {
          courtName = match.other_location;
        } else if (match.courts?.name) {
          courtName = match.courts.name;
        }

        return {
          match_id: match.id,
          match_date: match.match_date,
          created_at: match.created_at,
          team1_score: match.team1_score,
          team2_score: match.team2_score,
          court_name: courtName,
          other_location: match.other_location,
          event_name: match.events?.name || null,
          event_id: match.event_id,
          round_number: match.round_number,
          event_court_number: match.event_court_number,
          match_type: match.match_type || "league",
          rating_eligible: match.rating_eligible ?? true,
          verified_count: match.verified_by?.length || 0,
          created_by_name: match.profiles?.display_name || match.profiles?.full_name || "Unknown",
          players: playerNames,
          voided: match.voided || false,
          void_reason: match.void_reason,
        };
      });

    setMatches(matchRows);
    setLoading(false);
  };

  const applyFilters = () => {
    let filtered = [...matches];

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const filterDate = new Date();
      
      if (dateFilter === "today") {
        filterDate.setHours(0, 0, 0, 0);
      } else if (dateFilter === "7d") {
        filterDate.setDate(now.getDate() - 7);
      } else if (dateFilter === "30d") {
        filterDate.setDate(now.getDate() - 30);
      }

      filtered = filtered.filter(m => new Date(m.match_date) >= filterDate);
    }

    // Verified filter
    if (verifiedFilter === "full") {
      filtered = filtered.filter(m => m.verified_count === 4);
    } else if (verifiedFilter === "partial") {
      filtered = filtered.filter(m => m.verified_count > 0 && m.verified_count < 4);
    } else if (verifiedFilter === "none") {
      filtered = filtered.filter(m => m.verified_count === 0);
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter(m => m.match_type === typeFilter);
    }

    // Venue filter
    if (venueFilter === "official") {
      filtered = filtered.filter(m => !m.other_location);
    } else if (venueFilter === "other") {
      filtered = filtered.filter(m => m.other_location);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(m => 
        m.players.some(p => p.toLowerCase().includes(term)) ||
        m.event_name?.toLowerCase().includes(term) ||
        m.match_id.toLowerCase().includes(term) ||
        m.court_name.toLowerCase().includes(term)
      );
    }

    setFilteredMatches(filtered);
  };

  const exportToCSV = () => {
    const headers = ["Date", "Event", "Location", "Teams", "Score", "Type", "Verified", "Created By", "Match ID"];
    const rows = filteredMatches.map(m => [
      toLocaleDateStringEST(m.match_date),
      m.event_name || "—",
      m.court_name + (m.other_location ? " (Other)" : ""),
      m.players.join(" / "),
      `${m.team1_score}–${m.team2_score}`,
      m.match_type,
      `${m.verified_count}/4`,
      m.created_by_name,
      m.match_id
    ]);

    const csv = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matches-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  const activeFilterCount =
    (dateFilter !== "all" ? 1 : 0) +
    (verifiedFilter !== "all" ? 1 : 0) +
    (typeFilter !== "all" ? 1 : 0) +
    (venueFilter !== "all" ? 1 : 0);

  const filterControls = (
    <>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Date range</label>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Verification</label>
        <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Verification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="full">Fully verified (4/4)</SelectItem>
            <SelectItem value="partial">Partial (1-3)</SelectItem>
            <SelectItem value="none">None (0/4)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Match type</label>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Match type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="ladder">Ladder</SelectItem>
            <SelectItem value="league">League</SelectItem>
            <SelectItem value="playoffs">Playoffs</SelectItem>
            <SelectItem value="casual">Casual</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Location</label>
        <Select value={venueFilter} onValueChange={setVenueFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All locations</SelectItem>
            <SelectItem value="official">Community location</SelectItem>
            <SelectItem value="other">Custom location</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </>
  );

  return (
    <AdminLayout title="Match Directory">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div />
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>

        {/* Search + filter access. On mobile: search + filter chip.
            On desktop: 4 select controls stay inline. */}
        <div className="mb-6 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search matches, players, locations…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            {/* Mobile filter sheet */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" className="md:hidden shrink-0 h-10">
                  <SlidersHorizontal className="w-4 h-4" />
                  {activeFilterCount > 0 && (
                    <span className="ml-1.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 min-w-[1.25rem] text-center">
                      {activeFilterCount}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[80vh]">
                <SheetHeader className="text-left pb-4">
                  <SheetTitle className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Filters
                  </SheetTitle>
                </SheetHeader>
                <div className="space-y-4">
                  {filterControls}
                  {activeFilterCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDateFilter("all");
                        setVerifiedFilter("all");
                        setTypeFilter("all");
                        setVenueFilter("all");
                      }}
                      className="w-full"
                    >
                      Clear all filters
                    </Button>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Desktop: inline 4-col filter grid */}
          <div className="hidden md:grid md:grid-cols-4 gap-3">
            {filterControls}
          </div>
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-4">
          Showing {filteredMatches.length} of {matches.length} matches
        </p>

        {/* Matches list */}
        <div className="space-y-4">
          {filteredMatches.map((match) => (
            <Card key={match.match_id} className={match.voided ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{toLocaleDateStringEST(match.match_date)}</span>
                      {match.voided && (
                        <Badge variant="destructive">Voided</Badge>
                      )}
                      {match.event_name && (
                        <Badge variant="outline">
                          {match.event_name}
                          {match.round_number && ` • R${match.round_number}`}
                          {match.event_court_number && ` • C${match.event_court_number}`}
                        </Badge>
                      )}
                      <Badge variant="secondary">{match.match_type}</Badge>
                    </div>

                    <div className="text-sm">
                      <span className="text-muted-foreground">Location: </span>
                      <span>{match.court_name}</span>
                    </div>

                    <div className="text-sm">
                      <span className="text-muted-foreground">Players: </span>
                      <span>
                        {match.players && match.players.length > 0 
                          ? match.players.join(" / ") 
                          : <span className="text-destructive">No players found</span>
                        }
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                      <span className="font-bold text-lg">
                        {match.team1_score}–{match.team2_score}
                      </span>
                      <span className="text-muted-foreground">
                        Verified: {match.verified_count}/4
                      </span>
                      <span className="text-muted-foreground">
                        By: {match.created_by_name}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingMatchId(match.match_id)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {match.void_reason && (
                  <div className="mt-2 p-2 bg-destructive/10 rounded text-sm">
                    <span className="font-semibold">Void reason: </span>
                    {match.void_reason}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredMatches.length === 0 && (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              No matches found matching your filters
            </CardContent>
          </Card>
        )}
      </div>

      {editingMatchId && (
        <EditMatchSheet
          matchId={editingMatchId}
          open={!!editingMatchId}
          onOpenChange={(open) => !open && setEditingMatchId(null)}
          onSaved={() => {
            setEditingMatchId(null);
            fetchMatches();
          }}
        />
      )}
    </AdminLayout>
  );
};

export default AdminMatches;
