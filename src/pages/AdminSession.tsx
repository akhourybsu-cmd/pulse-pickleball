import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, PlayCircle, StopCircle, QrCode, Download, Tv, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

interface Court {
  id: string;
  name: string;
  location: string;
}

interface Session {
  id: string;
  name: string;
  session_date: string;
  start_time: string;
  num_courts: number;
  status: string;
  courts: {
    name: string;
  };
}

export default function AdminSession() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [courts, setCourts] = useState<Court[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  
  // Form state
  const [sessionName, setSessionName] = useState("");
  const [selectedCourt, setSelectedCourt] = useState("");
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState("18:00");
  const [numCourts, setNumCourts] = useState("3");
  const [matchType, setMatchType] = useState("ladder");
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedSessionForQR, setSelectedSessionForQR] = useState<Session | null>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkUserAccess();
    fetchCourts();
    fetchSessions();
  }, []);

  const checkUserAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    // Check if user is admin
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleData) {
      setIsAdmin(true);
    }

    setLoading(false);
  };

  const fetchCourts = async () => {
    const { data, error } = await supabase
      .from("courts")
      .select("*")
      .order("name");

    if (error) {
      console.error("Error fetching courts:", error);
      return;
    }

    if (data) {
      setCourts(data);
      // Auto-select Tilda Stone if available
      const tildaStone = data.find(c => c.name.includes("Tilda Stone"));
      if (tildaStone) {
        setSelectedCourt(tildaStone.id);
      }
    }
  };

  const fetchSessions = async () => {
    const { data, error } = await supabase
      .from("sessions")
      .select(`
        *,
        courts:court_id (name)
      `)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching sessions:", error);
      return;
    }

    if (data) {
      setSessions(data);
    }
  };

  const handleCreateSession = async () => {
    if (!sessionName || !selectedCourt) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("sessions")
        .insert({
          name: sessionName,
          court_id: selectedCourt,
          session_date: sessionDate,
          start_time: startTime,
          num_courts: parseInt(numCourts),
          match_type: matchType,
          status: "active",
          created_by: user.id,
        });

      if (error) {
        if (error.code === '23505') {
          toast({
            title: "Session Already Active",
            description: "There's already an active session at this court. End it before creating a new one.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Session Created!",
        description: "Players can now check in",
      });

      // Reset form
      setSessionName("");
      setSessionDate(new Date().toISOString().split('T')[0]);
      setStartTime("18:00");
      
      fetchSessions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleShowQR = (session: Session) => {
    setSelectedSessionForQR(session);
    setShowQRDialog(true);
  };

  const handleDownloadQR = () => {
    if (!qrRef.current) return;

    const svg = qrRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');

      const downloadLink = document.createElement('a');
      downloadLink.download = `session-qr-${selectedSessionForQR?.name}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const getQRUrl = (sessionId: string) => {
    return `${window.location.origin}/qr-checkin?session=${sessionId}`;
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ status: "completed" })
        .eq("id", sessionId);

      if (error) throw error;

      toast({
        title: "Session Ended",
        description: "Session has been marked as completed",
      });

      fetchSessions();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b bg-secondary/30">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
          <ThemeToggle />
        </div>
      </div>

      <div className="flex-1 container mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Session Management</h1>
          <p className="text-muted-foreground mt-2">
            Create and manage court sessions. Only one active session per court allowed.
          </p>
        </div>

        {/* Create New Session */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="session-name">Session Name</Label>
                <Input
                  id="session-name"
                  placeholder="e.g., Tuesday Night Pickleball"
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="court">Venue</Label>
                <Select value={selectedCourt} onValueChange={setSelectedCourt}>
                  <SelectTrigger id="court">
                    <SelectValue placeholder="Select venue" />
                  </SelectTrigger>
                  <SelectContent>
                    {courts.map((court) => (
                      <SelectItem key={court.id} value={court.id}>
                        {court.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Start Time</Label>
                <Input
                  id="time"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="num-courts">Number of Courts</Label>
                <Input
                  id="num-courts"
                  type="number"
                  min="1"
                  max="10"
                  value={numCourts}
                  onChange={(e) => setNumCourts(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="match-type">Match Type</Label>
                <Select value={matchType} onValueChange={setMatchType}>
                  <SelectTrigger id="match-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ladder">Ladder</SelectItem>
                    <SelectItem value="league">League</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={handleCreateSession} className="w-full">
              <PlayCircle className="mr-2 h-4 w-4" />
              Start Session
            </Button>
          </CardContent>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sessions yet</p>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-semibold">{session.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {session.courts.name} • {session.session_date} at {session.start_time}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {session.num_courts} courts • {session.status}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {session.status === "active" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/manage?session=${session.id}`)}
                          >
                            <Settings className="mr-2 h-4 w-4" />
                            Manage
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/kiosk?session=${session.id}`, '_blank')}
                          >
                            <Tv className="mr-2 h-4 w-4" />
                            Kiosk Display
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleShowQR(session)}
                          >
                            <QrCode className="mr-2 h-4 w-4" />
                            QR Code
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/admin/pairing?session=${session.id}`)}
                          >
                            Generate Pairings
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEndSession(session.id)}
                          >
                            <StopCircle className="mr-2 h-4 w-4" />
                            End Session
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          </Card>

        {/* QR Code Dialog */}
        <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Session QR Code</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {selectedSessionForQR && (
                <>
                  <div className="text-center space-y-2">
                    <p className="font-semibold">{selectedSessionForQR.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Scan to check in
                    </p>
                  </div>
                  <div 
                    ref={qrRef}
                    className="flex justify-center p-6 bg-white rounded-lg"
                  >
                    <QRCodeSVG
                      value={getQRUrl(selectedSessionForQR.id)}
                      size={256}
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground text-center break-all">
                    {getQRUrl(selectedSessionForQR.id)}
                  </div>
                  <Button 
                    onClick={handleDownloadQR} 
                    variant="outline" 
                    className="w-full"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download QR Code
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Footer />
    </div>
  );
}
