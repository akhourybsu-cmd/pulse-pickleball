import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { 
  Users, 
  Calendar, 
  Shuffle, 
  Settings, 
  QrCode,
  ArrowLeft,
  Trophy,
  LayoutDashboard
} from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
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
      <nav className="border-b bg-secondary">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <img src={logo} alt="PULSE Logo" className="h-16 w-auto" />
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Settings className="w-8 h-8 text-primary" />
            <h2 className="text-3xl font-bold">Admin Control Center</h2>
          </div>
          <p className="text-muted-foreground">Manage sessions, pairings, and system settings</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/admin/sessions")}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Calendar className="w-10 h-10 text-primary" />
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/admin/players")}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Users className="w-10 h-10 text-primary" />
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/admin/badges")}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Trophy className="w-10 h-10 text-primary" />
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/admin/manage")}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Users className="w-10 h-10 text-secondary" />
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/admin/pairing")}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Shuffle className="w-10 h-10 text-primary" />
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/kiosk")}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <LayoutDashboard className="w-10 h-10 text-secondary" />
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/qr-checkin")}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <QrCode className="w-10 h-10 text-primary" />
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

          <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate("/pending-matches")}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Trophy className="w-10 h-10 text-secondary" />
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
        </div>

        <Card className="mt-8 border-primary/20">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common administrative tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              <Button variant="outline" onClick={() => navigate("/admin/sessions")}>
                Create New Session
              </Button>
              <Button variant="outline" onClick={() => navigate("/match/new")}>
                Record Match
              </Button>
              <Button variant="outline" onClick={() => navigate("/court-board")}>
                View Court Board
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
};

export default AdminDashboard;
