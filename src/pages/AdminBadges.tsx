import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Award, Plus, Trash2, Search } from "lucide-react";
import logo from "@/assets/pulse-logo-new.png";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Footer } from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  tier: number;
}

interface PlayerBadge {
  id: string;
  player_id: string;
  badge_id: string;
  earned_at: string;
  badges: Badge;
}

interface Player {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
  current_rating: number;
}

const AdminBadges = () => {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerBadges, setPlayerBadges] = useState<PlayerBadge[]>([]);
  const [allBadges, setAllBadges] = useState<Badge[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedBadgeId, setSelectedBadgeId] = useState<string>("");
  const [processing, setProcessing] = useState(false);
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
      await fetchPlayers();
      await fetchAllBadges();
      setLoading(false);
    };

    checkAdminAccess();
  }, [navigate]);

  const fetchPlayers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url, current_rating')
      .order('full_name');

    if (error) {
      toast.error("Failed to load players");
      return;
    }

    setPlayers(data || []);
  };

  const fetchAllBadges = async () => {
    const { data, error } = await supabase
      .from('badges')
      .select('*')
      .order('category', { ascending: true })
      .order('tier', { ascending: true });

    if (error) {
      toast.error("Failed to load badges");
      return;
    }

    setAllBadges(data || []);
  };

  const fetchPlayerBadges = async (playerId: string) => {
    const { data, error } = await supabase
      .from('player_badges')
      .select(`
        id,
        player_id,
        badge_id,
        earned_at,
        badges (
          id,
          code,
          name,
          description,
          icon,
          category,
          tier
        )
      `)
      .eq('player_id', playerId)
      .order('earned_at', { ascending: false });

    if (error) {
      toast.error("Failed to load player badges");
      return;
    }

    setPlayerBadges(data || []);
  };

  const handlePlayerSelect = async (player: Player) => {
    setSelectedPlayer(player);
    await fetchPlayerBadges(player.id);
  };

  const handleAddBadge = async () => {
    if (!selectedPlayer || !selectedBadgeId) return;

    setProcessing(true);
    const { error } = await supabase
      .from('player_badges')
      .insert({
        player_id: selectedPlayer.id,
        badge_id: selectedBadgeId,
      });

    if (error) {
      if (error.code === '23505') {
        toast.error("Player already has this badge");
      } else {
        toast.error("Failed to award badge");
      }
    } else {
      toast.success("Badge awarded successfully!");
      await fetchPlayerBadges(selectedPlayer.id);
      setShowAddDialog(false);
      setSelectedBadgeId("");
    }
    setProcessing(false);
  };

  const handleRemoveBadge = async (playerBadgeId: string) => {
    if (!selectedPlayer) return;

    setProcessing(true);
    const { error } = await supabase
      .from('player_badges')
      .delete()
      .eq('id', playerBadgeId);

    if (error) {
      toast.error("Failed to remove badge");
    } else {
      toast.success("Badge removed successfully!");
      await fetchPlayerBadges(selectedPlayer.id);
    }
    setProcessing(false);
  };

  const filteredPlayers = players.filter(player =>
    player.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    player.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableBadges = allBadges.filter(
    badge => !playerBadges.some(pb => pb.badge_id === badge.id)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
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
          <Link to="/dashboard">
            <img src={logo} alt="PULSE Logo" className="h-16 w-auto cursor-pointer hover:opacity-80 transition-opacity" />
          </Link>
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Admin
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Award className="w-8 h-8 text-primary" />
            <h2 className="text-3xl font-bold">Badge Management</h2>
          </div>
          <p className="text-muted-foreground">Manually assign and remove badges from players</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Player List */}
          <Card>
            <CardHeader>
              <CardTitle>Select Player</CardTitle>
              <CardDescription>Choose a player to manage their badges</CardDescription>
              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {filteredPlayers.map((player) => (
                  <div
                    key={player.id}
                    onClick={() => handlePlayerSelect(player)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedPlayer?.id === player.id
                        ? 'bg-primary/10 border-primary'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarImage src={player.avatar_url || undefined} />
                        <AvatarFallback>{player.full_name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-semibold">{player.full_name}</p>
                        <p className="text-sm text-muted-foreground">{player.email}</p>
                      </div>
                      <Badge variant="secondary">
                        {player.current_rating?.toFixed(2) || '3.00'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Badge Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>
                    {selectedPlayer ? `${selectedPlayer.full_name}'s Badges` : 'Player Badges'}
                  </CardTitle>
                  <CardDescription>
                    {selectedPlayer ? 'Manage badges for this player' : 'Select a player to view badges'}
                  </CardDescription>
                </div>
                {selectedPlayer && (
                  <Button
                    onClick={() => setShowAddDialog(true)}
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Badge
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedPlayer ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Award className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>Select a player from the list to manage their badges</p>
                </div>
              ) : playerBadges.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Award className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>This player has no badges yet</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {playerBadges.map((playerBadge) => (
                    <div
                      key={playerBadge.id}
                      className="p-4 rounded-lg border bg-card"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-4xl">{playerBadge.badges.icon}</div>
                        <div className="flex-1">
                          <h4 className="font-semibold">{playerBadge.badges.name}</h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            {playerBadge.badges.description}
                          </p>
                          <div className="flex gap-2">
                            <Badge variant="outline" className="text-xs">
                              {playerBadge.badges.category}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              Tier {playerBadge.badges.tier}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-2">
                            Awarded: {new Date(playerBadge.earned_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleRemoveBadge(playerBadge.id)}
                          disabled={processing}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* All Available Badges Reference */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>All Available Badges</CardTitle>
            <CardDescription>Reference guide for all badges in the system</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {allBadges.map((badge) => (
                <div key={badge.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{badge.icon}</div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{badge.name}</h4>
                      <p className="text-xs text-muted-foreground mb-2">
                        {badge.description}
                      </p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          {badge.category}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Tier {badge.tier}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Badge Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Award Badge</DialogTitle>
            <DialogDescription>
              Select a badge to award to {selectedPlayer?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedBadgeId} onValueChange={setSelectedBadgeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a badge..." />
              </SelectTrigger>
              <SelectContent>
                {availableBadges.map((badge) => (
                  <SelectItem key={badge.id} value={badge.id}>
                    <div className="flex items-center gap-2">
                      <span>{badge.icon}</span>
                      <span>{badge.name}</span>
                      <Badge variant="outline" className="text-xs ml-2">
                        {badge.category}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedBadgeId && (
              <div className="mt-4 p-4 rounded-lg border bg-muted/50">
                {(() => {
                  const badge = allBadges.find(b => b.id === selectedBadgeId);
                  return badge ? (
                    <div className="flex items-start gap-3">
                      <div className="text-3xl">{badge.icon}</div>
                      <div>
                        <h4 className="font-semibold">{badge.name}</h4>
                        <p className="text-sm text-muted-foreground">{badge.description}</p>
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleAddBadge} 
              disabled={!selectedBadgeId || processing}
            >
              Award Badge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default AdminBadges;
