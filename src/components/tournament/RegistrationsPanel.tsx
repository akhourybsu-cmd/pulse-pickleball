import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CheckCircle, Clock, UserX, Download, Users } from "lucide-react";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface Registration {
  id: string;
  event_id: string;
  division_id: string;
  team_name: string;
  captain_user_id: string;
  partner_user_id: string | null;
  status: 'pending' | 'confirmed' | 'waitlisted' | 'cancelled';
  payment_status: 'unpaid' | 'paid' | 'refunded';
  registration_date: string;
  additional_info: any;
  notes: string | null;
  captain?: { full_name: string; display_name: string | null; email: string };
  partner?: { full_name: string; display_name: string | null; email: string };
  division?: { name: string };
}

interface Division {
  id: string;
  name: string;
}

interface RegistrationsPanelProps {
  eventId: string;
  divisions: Division[];
}

export function RegistrationsPanel({ eventId, divisions }: RegistrationsPanelProps) {
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchRegistrations();
  }, [eventId]);

  const fetchRegistrations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tournament_registrations")
      .select(`
        *,
        captain:profiles!tournament_registrations_captain_user_id_fkey(full_name, display_name, email),
        partner:profiles!tournament_registrations_partner_user_id_fkey(full_name, display_name, email),
        division:tournaments_divisions(name)
      `)
      .eq("event_id", eventId)
      .order("registration_date", { ascending: false });

    if (error) {
      toast({
        title: "Error loading registrations",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setRegistrations(data || []);
    }
    setLoading(false);
  };

  const handleUpdateStatus = async (registrationId: string, newStatus: Registration['status']) => {
    const { error } = await supabase
      .from("tournament_registrations")
      .update({ status: newStatus })
      .eq("id", registrationId);

    if (error) {
      toast({
        title: "Error updating status",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Status updated",
        description: `Registration ${newStatus}`,
      });
      fetchRegistrations();
    }
  };

  const handleBulkApprove = async (divisionId: string) => {
    // Get division max_teams
    const division = divisions.find(d => d.id === divisionId);
    const { data: divData } = await supabase
      .from("tournaments_divisions")
      .select("max_teams")
      .eq("id", divisionId)
      .single();

    const maxTeams = divData?.max_teams;
    
    // Get current confirmed count
    const confirmedCount = registrations.filter(
      r => r.division_id === divisionId && r.status === 'confirmed'
    ).length;

    // Get pending registrations
    const pendingRegs = registrations
      .filter(r => r.division_id === divisionId && r.status === 'pending')
      .sort((a, b) => new Date(a.registration_date).getTime() - new Date(b.registration_date).getTime());

    const spotsAvailable = maxTeams ? maxTeams - confirmedCount : pendingRegs.length;
    const toApprove = pendingRegs.slice(0, spotsAvailable);

    if (toApprove.length === 0) {
      toast({
        title: "No registrations to approve",
        description: "All pending registrations have been processed or division is full",
      });
      return;
    }

    const { error } = await supabase
      .from("tournament_registrations")
      .update({ status: 'confirmed' })
      .in('id', toApprove.map(r => r.id));

    if (error) {
      toast({
        title: "Error approving registrations",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Registrations approved",
        description: `${toApprove.length} team(s) confirmed`,
      });
      fetchRegistrations();
    }
  };

  const handleGenerateTeams = async () => {
    setGenerating(true);
    
    const confirmedRegs = registrations.filter(r => r.status === 'confirmed');
    
    // Check which registrations already have teams
    const { data: existingTeams } = await supabase
      .from("tournaments_teams")
      .select("division_id, player1_id, player2_id")
      .eq("division_id", confirmedRegs[0]?.division_id);

    const newTeams = confirmedRegs.filter(reg => {
      return !existingTeams?.some(team => 
        team.player1_id === reg.captain_user_id || 
        team.player2_id === reg.captain_user_id
      );
    });

    if (newTeams.length === 0) {
      toast({
        title: "No new teams to create",
        description: "All confirmed registrations already have teams",
      });
      setGenerating(false);
      return;
    }

    const teamsToInsert = newTeams.map(reg => ({
      division_id: reg.division_id,
      team_name: reg.team_name,
      player1_id: reg.captain_user_id,
      player2_id: reg.partner_user_id,
    }));

    const { error } = await supabase
      .from("tournaments_teams")
      .insert(teamsToInsert);

    if (error) {
      toast({
        title: "Error generating teams",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Teams created",
        description: `${teamsToInsert.length} team(s) added to divisions`,
      });
    }
    setGenerating(false);
  };

  const handleExportCSV = () => {
    const filteredData = getFilteredRegistrations();
    
    const csv = [
      ["Team Name", "Division", "Captain", "Partner", "Status", "Payment", "Registered"],
      ...filteredData.map(r => [
        r.team_name,
        r.division?.name || "",
        r.captain?.display_name || r.captain?.full_name || "",
        r.partner?.display_name || r.partner?.full_name || "TBD",
        r.status,
        r.payment_status,
        format(new Date(r.registration_date), "MMM d, yyyy h:mm a")
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `registrations-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const getFilteredRegistrations = () => {
    return registrations.filter(r => {
      const matchesSearch = searchQuery === "" || 
        r.team_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.captain?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.captain?.email.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const matchesDivision = divisionFilter === "all" || r.division_id === divisionFilter;
      
      return matchesSearch && matchesStatus && matchesDivision;
    });
  };

  const getStatusBadge = (status: Registration['status']) => {
    const config = {
      pending: { icon: Clock, variant: "secondary" as const, label: "Pending" },
      confirmed: { icon: CheckCircle, variant: "default" as const, label: "Confirmed" },
      waitlisted: { icon: Clock, variant: "outline" as const, label: "Waitlisted" },
      cancelled: { icon: UserX, variant: "destructive" as const, label: "Cancelled" },
    };
    const { icon: Icon, variant, label } = config[status];
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {label}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const filteredRegistrations = getFilteredRegistrations();
  const confirmedCount = registrations.filter(r => r.status === 'confirmed').length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Registrations ({registrations.length})</CardTitle>
            <CardDescription>
              {confirmedCount} confirmed • Manage team registrations and approvals
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            {confirmedCount > 0 && (
              <Button onClick={handleGenerateTeams} disabled={generating}>
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Users className="mr-2 h-4 w-4" />
                )}
                Generate Teams
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Input
            placeholder="Search by team name, captain name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Select value={divisionFilter} onValueChange={setDivisionFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Divisions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Divisions</SelectItem>
              {divisions.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="waitlisted">Waitlisted</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {divisionFilter !== "all" && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkApprove(divisionFilter)}
            >
              Approve All Pending
            </Button>
          </div>
        )}

        {filteredRegistrations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {registrations.length === 0 
              ? "No registrations yet" 
              : "No registrations match your filters"}
          </p>
        ) : (
          <div className="space-y-3">
            {filteredRegistrations.map((reg) => (
              <div
                key={reg.id}
                className="flex items-start justify-between p-4 border rounded-lg"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium">{reg.team_name}</h4>
                    {getStatusBadge(reg.status)}
                    <Badge variant="outline">{reg.division?.name}</Badge>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>
                      <span className="text-muted-foreground">Captain:</span>{" "}
                      {reg.captain?.display_name || reg.captain?.full_name}
                      <span className="text-muted-foreground ml-2">({reg.captain?.email})</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Partner:</span>{" "}
                      {reg.partner ? (
                        <>
                          {reg.partner.display_name || reg.partner.full_name}
                          <span className="text-muted-foreground ml-2">({reg.partner.email})</span>
                        </>
                      ) : (
                        <span className="italic text-muted-foreground">Looking for partner</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Registered: {format(new Date(reg.registration_date), "MMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  {reg.notes && (
                    <p className="text-sm text-muted-foreground italic">
                      Note: {reg.notes}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {reg.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleUpdateStatus(reg.id, 'confirmed')}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus(reg.id, 'waitlisted')}
                      >
                        Waitlist
                      </Button>
                    </>
                  )}
                  {reg.status === 'waitlisted' && (
                    <Button
                      size="sm"
                      onClick={() => handleUpdateStatus(reg.id, 'confirmed')}
                    >
                      Confirm
                    </Button>
                  )}
                  {(reg.status === 'pending' || reg.status === 'waitlisted') && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="sm" variant="destructive">
                          Cancel
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Cancel Registration?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will cancel the registration for "{reg.team_name}". 
                            The team can register again if spots are available.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleUpdateStatus(reg.id, 'cancelled')}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Cancel Registration
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
