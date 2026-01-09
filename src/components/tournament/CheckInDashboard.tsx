import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { 
  Loader2, 
  Search, 
  CheckCircle2, 
  Clock, 
  UserCheck, 
  QrCode,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";

interface Registration {
  id: string;
  team_name: string;
  captain_user_id: string | null;
  partner_user_id: string | null;
  captain_name?: string;
  partner_name?: string;
  division_id: string;
  division_name?: string;
  checked_in_at: string | null;
  check_in_notes: string | null;
}

interface CheckInDashboardProps {
  eventId: string;
  divisions: { id: string; name: string }[];
}

export function CheckInDashboard({ eventId, divisions }: CheckInDashboardProps) {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDivision, setSelectedDivision] = useState<string>("all");

  useEffect(() => {
    fetchRegistrations();
  }, [eventId]);

  const fetchRegistrations = async () => {
    setLoading(true);

    const divisionIds = divisions.map(d => d.id);

    const { data, error } = await supabase
      .from("tournament_registrations")
      .select("id, team_name, captain_user_id, partner_user_id, division_id, checked_in_at, check_in_notes")
      .in("division_id", divisionIds)
      .order("team_name");

    if (error) {
      toast({
        title: "Error loading registrations",
        description: error.message,
        variant: "destructive",
      });
    } else {
      // Get user IDs for profile lookup
      const userIds = new Set<string>();
      (data || []).forEach(reg => {
        if (reg.captain_user_id) userIds.add(reg.captain_user_id);
        if (reg.partner_user_id) userIds.add(reg.partner_user_id);
      });

      // Fetch profile names
      const profileMap = new Map<string, string>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, full_name")
          .in("id", Array.from(userIds));
        
        profiles?.forEach(p => {
          profileMap.set(p.id, p.display_name || p.full_name || "Unknown");
        });
      }

      // Map division names and player names
      const regsWithDivision = (data || []).map(reg => ({
        ...reg,
        division_name: divisions.find(d => d.id === reg.division_id)?.name || "Unknown",
        captain_name: reg.captain_user_id ? profileMap.get(reg.captain_user_id) || "Unknown" : undefined,
        partner_name: reg.partner_user_id ? profileMap.get(reg.partner_user_id) || undefined : undefined,
      }));
      setRegistrations(regsWithDivision);
    }

    setLoading(false);
  };

  const handleCheckIn = async (registrationId: string) => {
    const { error } = await supabase
      .from("tournament_registrations")
      .update({
        checked_in_at: new Date().toISOString(),
      })
      .eq("id", registrationId);

    if (error) {
      toast({
        title: "Error checking in",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Checked in!",
        description: "Team has been marked as present",
      });
      fetchRegistrations();
    }
  };

  const handleUndoCheckIn = async (registrationId: string) => {
    const { error } = await supabase
      .from("tournament_registrations")
      .update({
        checked_in_at: null,
        check_in_notes: null,
      })
      .eq("id", registrationId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Check-in removed",
        description: "Team check-in has been undone",
      });
      fetchRegistrations();
    }
  };

  // Filter registrations
  const filteredRegistrations = registrations.filter(reg => {
    const matchesSearch = 
      reg.team_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (reg.captain_name && reg.captain_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (reg.partner_name && reg.partner_name.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesDivision = selectedDivision === "all" || reg.division_id === selectedDivision;
    
    return matchesSearch && matchesDivision;
  });

  const checkedInCount = registrations.filter(r => r.checked_in_at).length;
  const totalCount = registrations.length;
  const checkInPercent = totalCount > 0 ? Math.round((checkedInCount / totalCount) * 100) : 0;

  if (loading) {
    return (
      <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Header */}
      <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <CardTitle>Check-In Status</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={fetchRegistrations}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Teams checked in</span>
                <span className="font-medium">{checkedInCount} / {totalCount}</span>
              </div>
              <Progress value={checkInPercent} className="h-3" />
            </div>
            <div className="text-center px-4 border-l">
              <p className="text-3xl font-bold text-primary">{checkInPercent}%</p>
              <p className="text-xs text-muted-foreground">Complete</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search teams or players..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={selectedDivision === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedDivision("all")}
          >
            All
          </Button>
          {divisions.map(div => (
            <Button
              key={div.id}
              variant={selectedDivision === div.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedDivision(div.id)}
            >
              {div.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Registration List */}
      <div className="space-y-2">
        {filteredRegistrations.length === 0 ? (
          <Card className="bg-gradient-to-br from-card to-muted/30 border-border/50">
            <CardContent className="py-8 text-center text-muted-foreground">
              No registrations found
            </CardContent>
          </Card>
        ) : (
          filteredRegistrations.map(reg => (
            <Card 
              key={reg.id} 
              className={`transition-colors ${
                reg.checked_in_at 
                  ? "bg-green-500/5 border-green-500/30" 
                  : "bg-gradient-to-br from-card to-muted/30 border-border/50"
              }`}
            >
              <CardContent className="py-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {reg.checked_in_at ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                    ) : (
                      <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium truncate">{reg.team_name}</p>
                        <Badge variant="outline" className="text-xs">
                          {reg.division_name}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {reg.captain_name || "Unknown"}
                        {reg.partner_name && ` & ${reg.partner_name}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {reg.checked_in_at ? (
                      <>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(reg.checked_in_at), "h:mm a")}
                        </span>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleUndoCheckIn(reg.id)}
                        >
                          Undo
                        </Button>
                      </>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => handleCheckIn(reg.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Check In
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
