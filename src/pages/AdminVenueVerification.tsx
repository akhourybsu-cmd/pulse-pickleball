import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Building2, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MapPin, 
  Globe, 
  Mail, 
  Phone,
  User,
  ExternalLink,
  Search,
  RefreshCw
} from "lucide-react";
import logo from "@/assets/pulse-logo-premium.svg";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

interface PendingVenue {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  website_url: string | null;
  verification_requested_at: string | null;
  owner_id: string;
  owner_email?: string;
  owner_name?: string;
  inquiry_data?: {
    contact_name?: string;
    email?: string;
    phone?: string;
    venue_type?: string;
    primary_goals?: string[];
    current_setup?: string;
    timeline?: string;
  };
}

export default function AdminVenueVerification() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingVenues, setPendingVenues] = useState<PendingVenue[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedVenue, setSelectedVenue] = useState<PendingVenue | null>(null);
  const [actionDialog, setActionDialog] = useState<"approve" | "reject" | null>(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    checkAdminAndFetch();
  }, []);

  const checkAdminAndFetch = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      toast.error("Please sign in to access admin features");
      navigate("/auth");
      return;
    }

    if (!(await isPlatformAdmin(user.id))) {
      toast.error("Access denied: Admin privileges required");
      navigate("/player/dashboard");
      return;
    }

    setIsAdmin(true);
    await fetchPendingVenues();
    setLoading(false);
  };

  const fetchPendingVenues = async () => {
    try {
      // Fetch venues with pending_verification state
      const { data: venues, error: venuesError } = await supabase
        .from("venues")
        .select("id, name, city, state, website_url, verification_requested_at, owner_id")
        .eq("activation_state", "pending_verification")
        .order("verification_requested_at", { ascending: true });

      if (venuesError) throw venuesError;

      if (!venues || venues.length === 0) {
        setPendingVenues([]);
        return;
      }

      // Fetch owner profiles
      const ownerIds = venues.map(v => v.owner_id).filter(Boolean);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, email")
        .in("id", ownerIds);

      // Fetch linked inquiries for additional contact info
      const venueIds = venues.map(v => v.id);
      const { data: inquiries } = await supabase
        .from("venue_inquiries")
        .select("converted_venue_id, contact_name, email, phone, venue_type, primary_goals, current_setup, timeline")
        .in("converted_venue_id", venueIds);

      // Merge data
      const enrichedVenues: PendingVenue[] = venues.map(venue => {
        const profile = profiles?.find(p => p.id === venue.owner_id);
        const inquiry = inquiries?.find(i => i.converted_venue_id === venue.id);

        return {
          ...venue,
          owner_email: profile?.email || inquiry?.email,
          owner_name: profile?.display_name || inquiry?.contact_name,
          inquiry_data: inquiry ? {
            contact_name: inquiry.contact_name,
            email: inquiry.email,
            phone: inquiry.phone,
            venue_type: inquiry.venue_type,
            primary_goals: inquiry.primary_goals,
            current_setup: inquiry.current_setup,
            timeline: inquiry.timeline,
          } : undefined,
        };
      });

      setPendingVenues(enrichedVenues);
    } catch (error) {
      console.error("Error fetching pending venues:", error);
      toast.error("Failed to load pending venues");
    }
  };

  const handleApprove = async () => {
    if (!selectedVenue) return;
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("venues")
        .update({
          activation_state: "pending",
          verification_approved_at: new Date().toISOString(),
          verification_approved_by: user.id,
          verification_notes: verificationNotes || null,
        })
        .eq("id", selectedVenue.id);

      if (error) throw error;

      // TODO: Trigger notification to venue owner
      // await supabase.functions.invoke("notify-venue-approved", { body: { venueId: selectedVenue.id } });

      toast.success(`${selectedVenue.name} has been approved!`);
      setActionDialog(null);
      setSelectedVenue(null);
      setVerificationNotes("");
      await fetchPendingVenues();
    } catch (error: any) {
      console.error("Error approving venue:", error);
      toast.error(error.message || "Failed to approve venue");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedVenue || !verificationNotes.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("venues")
        .update({
          activation_state: "suspended",
          verification_approved_at: new Date().toISOString(),
          verification_approved_by: user.id,
          verification_notes: `REJECTED: ${verificationNotes}`,
        })
        .eq("id", selectedVenue.id);

      if (error) throw error;

      toast.success(`${selectedVenue.name} has been rejected`);
      setActionDialog(null);
      setSelectedVenue(null);
      setVerificationNotes("");
      await fetchPendingVenues();
    } catch (error: any) {
      console.error("Error rejecting venue:", error);
      toast.error(error.message || "Failed to reject venue");
    } finally {
      setProcessing(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Unknown";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const filteredVenues = pendingVenues.filter(venue => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      venue.name.toLowerCase().includes(query) ||
      venue.city?.toLowerCase().includes(query) ||
      venue.state?.toLowerCase().includes(query) ||
      venue.owner_name?.toLowerCase().includes(query) ||
      venue.owner_email?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Checking admin access...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <nav className="bg-[#0B171F] border-b border-slate-800">
        <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
          <Link to="/admin" className="flex items-center gap-3">
            <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto cursor-pointer hover:opacity-90 transition-opacity" />
          </Link>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/admin")}
              className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-b from-[#0B171F] via-[#142029] to-background py-10 px-4">
        <div className="container mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-amber-500/20 rounded-xl">
              <Building2 className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Venue Verification
            </h1>
          </div>
          <p className="text-slate-400 ml-[68px]">
            Review and approve venue ownership claims
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Search and Refresh */}
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search venues, owners..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline" onClick={fetchPendingVenues}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingVenues.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Venues List */}
        {filteredVenues.length === 0 ? (
          <Card className="py-12">
            <CardContent className="text-center">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-muted-foreground">No venues pending verification.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filteredVenues.map((venue) => (
              <Card key={venue.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{venue.name}</CardTitle>
                        {venue.city && venue.state && (
                          <CardDescription className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {venue.city}, {venue.state}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* Contact Info */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Contact Information</p>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {venue.owner_name && (
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3" />
                            {venue.owner_name}
                          </div>
                        )}
                        {venue.owner_email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3 w-3" />
                            <a href={`mailto:${venue.owner_email}`} className="hover:underline">
                              {venue.owner_email}
                            </a>
                          </div>
                        )}
                        {venue.inquiry_data?.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3 w-3" />
                            <a href={`tel:${venue.inquiry_data.phone}`} className="hover:underline">
                              {venue.inquiry_data.phone}
                            </a>
                          </div>
                        )}
                        {venue.website_url && (
                          <div className="flex items-center gap-2">
                            <Globe className="h-3 w-3" />
                            <a 
                              href={venue.website_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:underline flex items-center gap-1"
                            >
                              Visit Website
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Inquiry Details */}
                    {venue.inquiry_data && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">From Inquiry</p>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          {venue.inquiry_data.venue_type && (
                            <p>Type: {venue.inquiry_data.venue_type}</p>
                          )}
                          {venue.inquiry_data.current_setup && (
                            <p>Current Setup: {venue.inquiry_data.current_setup}</p>
                          )}
                          {venue.inquiry_data.timeline && (
                            <p>Timeline: {venue.inquiry_data.timeline}</p>
                          )}
                          {venue.inquiry_data.primary_goals && venue.inquiry_data.primary_goals.length > 0 && (
                            <p>Goals: {venue.inquiry_data.primary_goals.join(", ")}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t">
                    <p className="text-xs text-muted-foreground">
                      Submitted: {formatDate(venue.verification_requested_at)}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedVenue(venue);
                          setActionDialog("reject");
                        }}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedVenue(venue);
                          setActionDialog("approve");
                        }}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Approve Dialog */}
      <Dialog open={actionDialog === "approve"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve Venue</DialogTitle>
            <DialogDescription>
              Approve <strong>{selectedVenue?.name}</strong> for access to Pulse. The owner will be notified and can proceed with onboarding.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                placeholder="Add any notes about this verification..."
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button onClick={handleApprove} disabled={processing}>
              {processing ? "Approving..." : "Approve Venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={actionDialog === "reject"} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Venue</DialogTitle>
            <DialogDescription>
              Reject <strong>{selectedVenue?.name}</strong>'s ownership claim. Please provide a reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Reason for Rejection *</label>
              <Textarea
                placeholder="Explain why this venue is being rejected..."
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                className="mt-1"
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleReject} 
              disabled={processing || !verificationNotes.trim()}
            >
              {processing ? "Rejecting..." : "Reject Venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
}
