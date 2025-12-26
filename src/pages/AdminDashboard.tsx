import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { 
  Users, 
  Calendar, 
  Shuffle, 
  Settings, 
  QrCode,
  ArrowLeft,
  Trophy,
  LayoutDashboard,
  Download,
  UserPlus,
  FileText,
  Swords,
  Megaphone,
  Shield,
  Fingerprint,
  Zap
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import logo from "@/assets/pulse-logo-new.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSignupQR, setShowSignupQR] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminAccess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("Please sign in to access admin features");
        navigate("/auth");
        return;
      }

      // Check if user has admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        toast.error("Access denied: Admin privileges required");
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    };

    checkAdminAccess();
  }, [navigate]);

  const getSignupUrl = () => {
    return `https://pulsepb.com/auth`;
  };

  const handleDownloadSignupQR = () => {
    const svg = document.getElementById("signup-qr-code");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = "pickleball-signup-qr.png";
      downloadLink.href = pngFile;
      downloadLink.click();

      toast.success("QR code downloaded successfully!");
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleRecalculateRatings = async () => {
    setRecalculating(true);
    try {
      const { error } = await supabase.rpc('recalculate_all_ratings_authenticated');
      if (error) throw error;
      toast.success("All player ratings and stats have been recalculated!");
    } catch (error: any) {
      toast.error("Failed to recalculate ratings. Please try again.");
      console.error(error);
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Checking admin access...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Premium Dark Header */}
      <nav className="bg-[#0B171F] border-b border-slate-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <img src={logo} alt="PULSE Logo" className="h-[80px] w-auto cursor-pointer hover:opacity-90 transition-opacity" />
          </Link>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
              className="border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Gradient Hero Section */}
      <div className="bg-gradient-to-b from-[#0B171F] via-[#142029] to-background py-10 px-4">
        <div className="container mx-auto">
          <div className="flex items-center gap-4 mb-3">
            <div className="p-3 bg-[#A6DB5A]/20 rounded-xl">
              <Settings className="w-8 h-8 text-[#A6DB5A]" />
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">
              Admin Control Center
            </h1>
          </div>
          <p className="text-slate-400 ml-[68px]">
            Manage sessions, pairings, and system settings
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/admin/session")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <Calendar className="w-8 h-8 text-primary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Session Management</CardTitle>
              <CardDescription>
                Create and manage pickleball sessions, generate QR codes for check-ins
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                Manage Sessions
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/admin/players")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <Users className="w-8 h-8 text-primary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Player Directory</CardTitle>
              <CardDescription>
                Search and view all player profiles in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                View Players
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/admin/badges")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <Trophy className="w-8 h-8 text-primary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Badge Management</CardTitle>
              <CardDescription>
                Manually assign and remove badges from player profiles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                Manage Badges
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/admin/manage")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-secondary/20 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <Users className="w-8 h-8 text-secondary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Active Session Control</CardTitle>
              <CardDescription>
                Monitor live sessions, manage queues, create manual matches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                Control Sessions
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/admin/pairing")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <Shuffle className="w-8 h-8 text-primary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Auto Pairing System</CardTitle>
              <CardDescription>
                Generate balanced match pairings based on player ratings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                Generate Pairings
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/admin/matches")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <FileText className="w-8 h-8 text-primary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Match Directory</CardTitle>
              <CardDescription>
                View, edit, and manage all matches with filters and CSV export
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                View Matches
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/kiosk")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-secondary/20 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <LayoutDashboard className="w-8 h-8 text-secondary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Kiosk Display</CardTitle>
              <CardDescription>
                View live match board and queue status for court displays
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                Open Kiosk
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/tournament-admin")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <Swords className="w-8 h-8 text-primary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Tournament Portal</CardTitle>
              <CardDescription>
                Manage tournaments, divisions, and round-robin play
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                Manage Tournaments
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/qr-checkin")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <QrCode className="w-8 h-8 text-primary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">QR Check-In</CardTitle>
              <CardDescription>
                Player check-in interface for session queues
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                Check-In Portal
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/pending-matches")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-secondary/20 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <Trophy className="w-8 h-8 text-secondary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Pending Matches</CardTitle>
              <CardDescription>
                Review and approve match results, handle contested matches
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                Review Matches
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => setShowSignupQR(true)}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <UserPlus className="w-8 h-8 text-primary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Sign Up QR Code</CardTitle>
              <CardDescription>
                Generate QR code for new players to join and register
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                View QR Code
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/admin/marketing")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <Megaphone className="w-8 h-8 text-primary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Marketing Materials</CardTitle>
              <CardDescription>
                One-pagers, talking points, and sales tools for promoting Pulse
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                View Materials
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/admin/biometrics")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <Fingerprint className="w-8 h-8 text-primary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Biometric Analytics</CardTitle>
              <CardDescription>
                Track biometric authentication adoption and performance metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                View Analytics
              </Button>
            </CardContent>
          </Card>

          <Card 
            className="group hover:shadow-xl transition-all duration-300 cursor-pointer border-l-4 border-l-transparent hover:border-l-[#A6DB5A] hover:-translate-y-1" 
            onClick={() => navigate("/admin/audit-log")}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-primary/10 rounded-lg group-hover:bg-[#A6DB5A]/20 transition-colors">
                  <Shield className="w-8 h-8 text-primary group-hover:text-[#A6DB5A] transition-colors" />
                </div>
              </div>
              <CardTitle className="mt-4">Admin Audit Log</CardTitle>
              <CardDescription>
                View complete history of all administrative actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full" variant="secondary">
                View Audit Log
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-8 bg-[#142029] border-slate-700/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#A6DB5A]" />
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </div>
            <CardDescription className="text-slate-400">Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <Button 
                variant="outline" 
                onClick={() => navigate("/admin/session")}
                className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white hover:border-[#A6DB5A]"
              >
                Create New Session
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/match/new")}
                className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white hover:border-[#A6DB5A]"
              >
                Record Match
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate("/court-board")}
                className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white hover:border-[#A6DB5A]"
              >
                View Court Board
              </Button>
              <Button 
                variant="outline" 
                onClick={handleRecalculateRatings}
                disabled={recalculating}
                className="border-slate-600 text-slate-200 hover:bg-slate-700 hover:text-white hover:border-[#A6DB5A] disabled:opacity-50"
              >
                {recalculating ? "Recalculating..." : "Recalculate All Ratings"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showSignupQR} onOpenChange={setShowSignupQR}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pickleball Sign Up QR Code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 p-6">
            <div className="bg-white p-6 rounded-lg">
              <QRCodeSVG
                id="signup-qr-code"
                value={getSignupUrl()}
                size={256}
                level="H"
                includeMargin
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Scan this QR code to sign up for Pickleball
            </p>
            <div className="flex gap-2 w-full">
              <Button 
                onClick={handleDownloadSignupQR}
                className="flex-1"
              >
                <Download className="w-4 h-4 mr-2" />
                Download QR Code
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
