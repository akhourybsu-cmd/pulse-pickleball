import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Share2, Copy, Settings, LogOut, Bell } from "lucide-react";
import { toast } from "sonner";
import { RatingDisplay } from "./RatingDisplay";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationBell } from "@/components/NotificationBell";
import { UnverifiedMatchesIndicator } from "@/components/UnverifiedMatchesIndicator";
import logo from "@/assets/pulse-logo-new.png";

interface ProfileHeroProps {
  userId: string | undefined;
  fullName: string | null;
  displayName: string | null;
  avatarUrl?: string | null;
  location?: string | null;
  currentRating: number | undefined;
  totalMatches: number | undefined;
  wins: number | undefined;
  losses: number | undefined;
  partnersCount?: number;
  courtsPlayed?: number;
  unreadNotifications?: number;
  onNotificationOpen?: () => void;
  onSignOut?: () => void;
}

export const ProfileHero = ({
  userId,
  fullName,
  displayName,
  avatarUrl,
  location,
  currentRating,
  totalMatches,
  wins,
  losses,
  partnersCount = 0,
  courtsPlayed = 0,
  unreadNotifications = 0,
  onNotificationOpen,
  onSignOut,
}: ProfileHeroProps) => {
  const navigate = useNavigate();
  const name = displayName || fullName || "Player";
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // Determine tier based on rating
  const getTier = (rating: number | undefined) => {
    if (!rating) return { name: "Unrated", color: "bg-muted text-muted-foreground" };
    if (rating >= 4.5) return { name: "Diamond", color: "bg-cyan-500 text-white" };
    if (rating >= 4.0) return { name: "Platinum", color: "bg-slate-400 text-white" };
    if (rating >= 3.5) return { name: "Gold", color: "bg-yellow-500 text-black" };
    if (rating >= 3.0) return { name: "Silver", color: "bg-slate-300 text-black" };
    return { name: "Bronze", color: "bg-amber-600 text-white" };
  };

  const tier = getTier(currentRating);

  const handleShare = async () => {
    const shareData = {
      title: "Pulse Pickleball",
      text: `Check out my Pulse profile!`,
      url: `https://pulsepb.com/profile/${userId}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success("Thanks for sharing!");
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast.success("Profile link copied!");
      }
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Error sharing:", error);
      }
    }
  };

  const handleCopyId = async () => {
    if (userId) {
      const shortId = `PULSE-${userId.slice(0, 6).toUpperCase()}`;
      await navigator.clipboard.writeText(shortId);
      toast.success("Player ID copied!");
    }
  };

  return (
    <div className="relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary via-primary/90 to-primary/70 dark:from-primary/80 dark:via-primary/60 dark:to-secondary" />
      
      {/* Subtle Pattern Overlay */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: '24px 24px'
        }} />
      </div>

      {/* Content */}
      <div className="relative px-4 pt-4 pb-6">
        {/* Top Navigation Row */}
        <div className="flex items-center justify-between mb-6">
          <img 
            src={logo} 
            alt="PULSE" 
            className="h-12 w-auto brightness-0 invert opacity-90" 
          />
          <div className="flex items-center gap-2">
            <UnverifiedMatchesIndicator />
            <ThemeToggle />
            <NotificationBell 
              unreadCount={unreadNotifications}
              onOpen={onNotificationOpen}
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={onSignOut}
              className="text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Profile Info */}
        <div className="flex items-start gap-4 mb-6">
          <Avatar 
            className="h-20 w-20 border-4 border-white/30 shadow-lg cursor-pointer hover:border-white/50 transition-colors"
            onClick={() => navigate(`/profile/${userId}`)}
          >
            <AvatarImage src={avatarUrl || undefined} alt={name} />
            <AvatarFallback className="text-xl font-bold bg-secondary text-secondary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-primary-foreground truncate">
              {name}
            </h1>
            <p className="text-primary-foreground/70 text-sm">
              {location || "Location not set"}
            </p>
            <Badge className={`mt-2 ${tier.color}`}>
              {tier.name}
            </Badge>
          </div>
        </div>

        {/* Social Stats */}
        <div className="flex items-center justify-center gap-8 mb-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-foreground">{partnersCount}</p>
            <p className="text-xs text-primary-foreground/70">Partners</p>
          </div>
          <div className="w-px h-8 bg-primary-foreground/20" />
          <div className="text-center">
            <p className="text-2xl font-bold text-primary-foreground">{courtsPlayed}</p>
            <p className="text-xs text-primary-foreground/70">Courts Played</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleShare}
            className="bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Share Profile
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCopyId}
            className="bg-white/20 hover:bg-white/30 text-primary-foreground border-0"
          >
            <Copy className="h-4 w-4 mr-2" />
            Copy ID
          </Button>
        </div>

        {/* Rating Display */}
        <RatingDisplay
          doublesRating={currentRating}
          singlesRating={undefined}
          totalMatches={totalMatches}
          wins={wins}
          losses={losses}
        />
      </div>
    </div>
  );
};
