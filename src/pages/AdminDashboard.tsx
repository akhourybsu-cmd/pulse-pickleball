import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  Users, Calendar, Shuffle, QrCode, Download, LayoutDashboard, UserPlus,
  FileText, Swords, Megaphone, Shield, Fingerprint, Zap, Activity,
  Building2, Archive, Trophy, ChevronDown, RefreshCw, ExternalLink,
  ListChecks,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { cn } from "@/lib/utils";

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSignupQR, setShowSignupQR] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAdminAccess = async () => {
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
      setLoading(false);
    };
    checkAdminAccess();
  }, [navigate]);

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
      const a = document.createElement("a");
      a.download = "pulse-signup-qr.png";
      a.href = pngFile;
      a.click();
      toast.success("QR code downloaded");
    };
    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const handleRecalculateRatings = async () => {
    setRecalculating(true);
    try {
      const { error } = await supabase.rpc("recalculate_all_ratings_authenticated");
      if (error) throw error;
      toast.success("All ratings recalculated");
    } catch (error) {
      toast.error("Recalc failed — see console");
      console.error(error);
    } finally {
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Checking admin access…</p>
      </div>
    );
  }
  if (!isAdmin) return null;

  return (
    <AdminLayout subtitle="Sessions, players, matches, and system tools">
      <div className="container mx-auto px-4 py-6 space-y-8">
        {/* ============= LIVE OPS (hero) ============= */}
        <section>
          <SectionHeader
            icon={<Zap className="w-4 h-4 text-primary" />}
            title="Live ops"
            hint="What you need during a session"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HeroTile
              icon={Calendar}
              title="Sessions"
              desc="Create, manage, generate check-in QR codes"
              onClick={() => navigate("/admin/session")}
              tone="primary"
            />
            <HeroTile
              icon={Zap}
              title="Live Session Control"
              desc="Monitor active queues, create manual matches"
              onClick={() => navigate("/admin/manage")}
              tone="primary"
            />
            <HeroTile
              icon={Shuffle}
              title="Auto Pair"
              desc="Generate balanced pairings from the queue"
              onClick={() => navigate("/admin/pairing")}
            />
            <HeroTile
              icon={QrCode}
              title="QR Check-In"
              desc="Player self-service check-in portal"
              onClick={() => navigate("/qr-checkin")}
            />
            <HeroTile
              icon={LayoutDashboard}
              title="Kiosk Display"
              desc="Full-screen court + queue board for the room"
              onClick={() => navigate("/kiosk")}
            />
            <HeroTile
              icon={UserPlus}
              title="Sign-up QR"
              desc="Share a QR that jumps new players to registration"
              onClick={() => setShowSignupQR(true)}
            />
          </div>
        </section>

        {/* ============= PLAYERS & MATCHES ============= */}
        <section>
          <SectionHeader
            icon={<Users className="w-4 h-4 text-primary" />}
            title="Players & matches"
            hint="Directories and moderation"
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ListTile
              icon={Users}
              title="Player Directory"
              onClick={() => navigate("/admin/players")}
            />
            <ListTile
              icon={FileText}
              title="Match Directory"
              onClick={() => navigate("/admin/matches")}
            />
            <ListTile
              icon={ListChecks}
              title="Leagues"
              onClick={() => navigate("/player/leagues")}
            />
            <ListTile
              icon={Trophy}
              title="Badges"
              onClick={() => navigate("/admin/badges")}
            />
            <ListTile
              icon={Trophy}
              title="Pending Matches"
              onClick={() => navigate("/pending-matches")}
            />
          </div>
        </section>

        {/* ============= DIAGNOSTICS (compact) ============= */}
        <section>
          <SectionHeader
            icon={<Activity className="w-4 h-4 text-primary" />}
            title="Diagnostics"
            hint="Troubleshoot and recompute"
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <ChipTile
              icon={Activity}
              title="System Health"
              onClick={() => navigate("/admin/system-health")}
            />
            <ChipTile
              icon={Shield}
              title="Audit Log"
              onClick={() => navigate("/admin/audit-log")}
            />
            <ChipTile
              icon={Fingerprint}
              title="Biometrics"
              onClick={() => navigate("/admin/biometrics")}
            />
            <button
              type="button"
              onClick={handleRecalculateRatings}
              disabled={recalculating}
              className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3.5 py-2.5 text-left text-sm hover:bg-muted transition-colors disabled:opacity-60"
            >
              <RefreshCw className={cn("w-4 h-4 text-primary shrink-0", recalculating && "animate-spin")} />
              <span className="truncate">
                {recalculating ? "Recalculating…" : "Recalculate ratings"}
              </span>
            </button>
          </div>
        </section>

        {/* ============= ADVANCED (collapsed) ============= */}
        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="w-full flex items-center justify-between rounded-lg border border-border/70 bg-card px-4 py-3 hover:bg-muted/60 transition-colors"
            >
              <span className="text-sm font-medium">Advanced tools</span>
              <ChevronDown
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform",
                  advancedOpen && "rotate-180",
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <ChipTile
                icon={UserPlus}
                title="Test Accounts"
                onClick={() => navigate("/admin/test-accounts")}
              />
              <ChipTile
                icon={Megaphone}
                title="Marketing Materials"
                onClick={() => navigate("/admin/marketing")}
              />
              <ChipTile
                icon={Swords}
                title="Tournament Portal"
                onClick={() => navigate("/tournament-admin")}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* ============= ARCHIVED (small link footer) ============= */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-2 text-xs text-muted-foreground border-t border-border/60 pt-4">
          <span className="font-medium">Archived surfaces:</span>
          <button
            type="button"
            onClick={() => navigate("/admin/venue-verification")}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <Building2 className="w-3.5 h-3.5" />
            Venue verification
          </button>
          <button
            type="button"
            onClick={() => navigate("/archive")}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <Archive className="w-3.5 h-3.5" />
            Full archive
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Sign-up QR modal */}
      <Dialog open={showSignupQR} onOpenChange={setShowSignupQR}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sign-up QR code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center space-y-4 p-4">
            <div className="bg-white p-6 rounded-lg">
              <QRCodeSVG
                id="signup-qr-code"
                value="https://pulsepb.com/auth"
                size={240}
                level="H"
                includeMargin
              />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              Point a camera at this code to jump to sign-up.
            </p>
            <Button onClick={handleDownloadSignupQR} className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Download PNG
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

/* ---------- section primitives ---------- */

const SectionHeader = ({
  icon, title, hint,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
}) => (
  <div className="mb-3 flex items-baseline gap-2">
    <div className="flex items-center gap-1.5">
      {icon}
      <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
    </div>
    {hint && (
      <span className="text-xs text-muted-foreground truncate">{hint}</span>
    )}
  </div>
);

const HeroTile = ({
  icon: Icon, title, desc, onClick, tone,
}: {
  icon: typeof Users;
  title: string;
  desc: string;
  onClick: () => void;
  tone?: "primary";
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "text-left rounded-xl border bg-card p-4 hover:bg-muted/50 hover:border-primary/40 transition-colors",
      tone === "primary" && "border-primary/30",
    )}
  >
    <div className="flex items-start gap-3">
      <div
        className={cn(
          "p-2 rounded-lg shrink-0",
          tone === "primary" ? "bg-primary/15 text-primary" : "bg-muted text-foreground",
        )}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{desc}</div>
      </div>
    </div>
  </button>
);

const ListTile = ({
  icon: Icon, title, onClick,
}: {
  icon: typeof Users;
  title: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card p-3 hover:bg-muted/60 hover:border-primary/40 transition-colors text-left"
  >
    <Icon className="w-4 h-4 text-primary shrink-0" />
    <span className="text-sm font-medium truncate">{title}</span>
  </button>
);

const ChipTile = ({
  icon: Icon, title, onClick,
}: {
  icon: typeof Users;
  title: string;
  onClick: () => void;
}) => (
  <button
    type="button"
    onClick={onClick}
    className="flex items-center gap-2 rounded-lg border border-border/70 bg-card px-3.5 py-2.5 hover:bg-muted transition-colors text-left"
  >
    <Icon className="w-4 h-4 text-primary shrink-0" />
    <span className="text-sm truncate">{title}</span>
  </button>
);

export default AdminDashboard;
