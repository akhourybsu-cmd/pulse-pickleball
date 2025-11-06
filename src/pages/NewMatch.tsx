import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayerCombobox } from "@/components/PlayerCombobox";
import { z } from "zod";
import MatchConfirmationDialog from "@/components/MatchConfirmationDialog";
import { PageHeader } from "@/components/PageHeader";

const matchSchema = z.object({
  matchDate: z.string().refine((date) => {
    const matchDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return matchDate <= today;
  }, "Match date cannot be in the future"),
  team1Score: z.number().int().min(0, "Score must be non-negative").max(99, "Score too high"),
  team2Score: z.number().int().min(0, "Score must be non-negative").max(99, "Score too high"),
  players: z.array(z.string().uuid()).length(4, "Must select exactly 4 players"),
}).refine((data) => data.team1Score !== data.team2Score, {
  message: "Scores cannot be tied",
  path: ["team2Score"],
});

interface Profile {
  id: string;
  full_name: string;
  display_name: string | null;
  current_rating: number;
  week_start_rating: number;
  total_matches: number;
  wins: number;
  losses: number;
}

const NewMatch = () => {
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<Profile[]>([]);
  const [courts, setCourts] = useState<Array<{ id: string; name: string; city: string; state: string }>>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [matchData, setMatchData] = useState<any>(null);
  
  const [team1Player1, setTeam1Player1] = useState("");
  const [team1Player2, setTeam1Player2] = useState("");
  const [team2Player1, setTeam2Player1] = useState("");
  const [team2Player2, setTeam2Player2] = useState("");
  const [team1Score, setTeam1Score] = useState("");
  const [team2Score, setTeam2Score] = useState("");
  const [selectedCourt, setSelectedCourt] = useState("");
  const [otherLocation, setOtherLocation] = useState("");
  const [matchDate, setMatchDate] = useState(new Date().toISOString().split("T")[0]);
  
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      setCurrentUserId(user.id);

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, display_name, current_rating, week_start_rating, total_matches, wins, losses")
        .order("full_name");

      if (profilesData) {
        setPlayers(profilesData);
        const currentUser = profilesData.find(p => p.id === user.id);
        setCurrentUserName(currentUser?.display_name || currentUser?.full_name || "You");
        setTeam1Player1(user.id);
      }

      // Fetch courts
      const { data: courtsData } = await supabase
        .from("courts")
        .select("id, name, city, state")
        .order("name");

      if (courtsData) {
        setCourts(courtsData);
        
        const { data: profileData } = await supabase
          .from("profiles")
          .select("home_court_id")
          .eq("id", user.id)
          .single();
        
        if (courtsData.length > 0) {
          if (profileData?.home_court_id && courtsData.some(c => c.id === profileData.home_court_id)) {
            setSelectedCourt(profileData.home_court_id);
          } else {
            setSelectedCourt(courtsData[0].id);
          }
        }
      }
    };

    fetchData();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const selectedPlayers = [team1Player1, team1Player2, team2Player1, team2Player2];
      const uniquePlayers = new Set(selectedPlayers);
      
      if (uniquePlayers.size !== 4) {
        toast.error("Please select 4 different players");
        setLoading(false);
        return;
      }

      const score1 = parseInt(team1Score);
      const score2 = parseInt(team2Score);

      // Validate input
      const validationResult = matchSchema.safeParse({
        matchDate,
        team1Score: score1,
        team2Score: score2,
        players: selectedPlayers,
      });

      if (!validationResult.success) {
        const firstError = validationResult.error.errors[0];
        toast.error(firstError.message);
        setLoading(false);
        return;
      }

      // Get player names
      const team1Player1Name = players.find(p => p.id === team1Player1)?.display_name || 
                              players.find(p => p.id === team1Player1)?.full_name || "";
      const team1Player2Name = players.find(p => p.id === team1Player2)?.display_name || 
                              players.find(p => p.id === team1Player2)?.full_name || "";
      const team2Player1Name = players.find(p => p.id === team2Player1)?.display_name || 
                              players.find(p => p.id === team2Player1)?.full_name || "";
      const team2Player2Name = players.find(p => p.id === team2Player2)?.display_name || 
                              players.find(p => p.id === team2Player2)?.full_name || "";

      const courtName = courts.find(c => c.id === selectedCourt)
        ? `${courts.find(c => c.id === selectedCourt)?.name} - ${courts.find(c => c.id === selectedCourt)?.city}, ${courts.find(c => c.id === selectedCourt)?.state}`
        : "";

      // Set match data and show confirmation dialog
      setMatchData({
        team1Player1,
        team1Player1Name,
        team1Player2,
        team1Player2Name,
        team2Player1,
        team2Player1Name,
        team2Player2,
        team2Player2Name,
        team1Score,
        team2Score,
        matchDate,
        selectedCourt,
        courtName,
        otherLocation,
        currentUserId,
        currentUserName,
      });
      setShowConfirmation(true);
    } catch (error: any) {
      toast.error("Failed to proceed. Please try again.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmationSuccess = () => {
    setShowConfirmation(false);
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(180deg, #F9FBF8 0%, #F3F9F6 100%)' }}>
      <PageHeader userId={currentUserId} />

      {/* Progress Indicator */}
      <div className="w-full bg-[#E9F4F1] h-2">
        <div 
          className="h-full transition-all duration-500 ease-out"
          style={{ 
            width: '50%', 
            background: 'linear-gradient(90deg, #A9CF46 0%, #96C13F 100%)'
          }}
        />
      </div>
      <div className="container mx-auto px-4 py-2 text-center">
        <p className="text-sm font-medium" style={{ color: '#0F2E33' }}>
          Step 1 of 2: Record Match Details
        </p>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-[700px]">
        <Card 
          className="animate-fade-in shadow-lg"
          style={{ 
            borderRadius: '18px',
            background: '#ffffff',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
          }}
        >
          <CardHeader className="text-center pb-6">
            <CardTitle 
              className="text-3xl font-semibold"
              style={{ color: '#0F2E33' }}
            >
              Record New Match
            </CardTitle>
            <div 
              className="mx-auto mt-2"
              style={{
                width: '60px',
                height: '3px',
                borderRadius: '3px',
                background: '#A9CF46'
              }}
            />
            <CardDescription 
              className="mt-4 text-base"
              style={{ color: '#0F2E33', opacity: 0.7 }}
            >
              Enter the details of your doubles match
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Match Details Section */}
              <div className="space-y-4 animate-fade-in" style={{ animationDelay: '100ms' }}>
                <div className="space-y-2">
                  <Label 
                    htmlFor="matchDate" 
                    className="text-sm font-semibold"
                    style={{ color: '#0F2E33' }}
                  >
                    Match Date
                  </Label>
                  <Input
                    id="matchDate"
                    type="date"
                    value={matchDate}
                    onChange={(e) => setMatchDate(e.target.value)}
                    required
                    className="transition-all duration-200"
                    style={{
                      background: '#F8FBF6',
                      borderRadius: '12px',
                      border: '1px solid #DCE8D1',
                      padding: '10px 14px'
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label 
                    htmlFor="court"
                    className="text-sm font-semibold"
                    style={{ color: '#0F2E33' }}
                  >
                    Court Location
                  </Label>
                  <Select value={selectedCourt} onValueChange={setSelectedCourt} required>
                    <SelectTrigger
                      className="transition-all duration-200"
                      style={{
                        background: '#F8FBF6',
                        borderRadius: '12px',
                        border: '1px solid #DCE8D1',
                        padding: '10px 14px'
                      }}
                    >
                      <SelectValue placeholder="Select court" />
                    </SelectTrigger>
                    <SelectContent>
                      {courts.map((court) => (
                        <SelectItem key={court.id} value={court.id}>
                          {court.name} - {court.city}, {court.state}
                        </SelectItem>
                      ))}
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {selectedCourt === 'other' && (
                  <div className="space-y-2 animate-fade-in">
                    <Label 
                      htmlFor="otherLocation"
                      className="text-sm font-semibold"
                      style={{ color: '#0F2E33' }}
                    >
                      Location Name
                    </Label>
                    <Input
                      id="otherLocation"
                      value={otherLocation}
                      onChange={(e) => setOtherLocation(e.target.value)}
                      placeholder="Enter custom location name"
                      required
                      style={{
                        background: '#F8FBF6',
                        borderRadius: '12px',
                        border: '1px solid #DCE8D1',
                        padding: '10px 14px'
                      }}
                    />
                  </div>
                )}
              </div>

              {/* Team 1 Section */}
              <div 
                className="animate-fade-in"
                style={{ 
                  animationDelay: '200ms',
                  border: '1px solid rgba(169, 207, 70, 0.3)',
                  borderRadius: '12px',
                  padding: '20px',
                  background: '#ffffff'
                }}
              >
                <h3 
                  className="font-semibold text-lg mb-4"
                  style={{ color: '#A9CF46' }}
                >
                  Team 1
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold" style={{ color: '#0F2E33' }}>
                      Player 1 (You)
                    </Label>
                    <PlayerCombobox
                      players={players}
                      value={team1Player1}
                      onValueChange={setTeam1Player1}
                      placeholder="You"
                      disabled={true}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold" style={{ color: '#0F2E33' }}>
                      Player 2
                    </Label>
                    <PlayerCombobox
                      players={players}
                      value={team1Player2}
                      onValueChange={setTeam1Player2}
                      placeholder="Search player..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label 
                      htmlFor="team1Score"
                      className="text-sm font-semibold"
                      style={{ color: '#0F2E33' }}
                    >
                      Team 1 Score
                    </Label>
                    <Input
                      id="team1Score"
                      type="number"
                      min="0"
                      value={team1Score}
                      onChange={(e) => setTeam1Score(e.target.value)}
                      required
                      className="text-2xl font-bold text-center transition-all duration-200"
                      style={{
                        background: '#F8FBF6',
                        borderRadius: '12px',
                        border: '1px solid #DCE8D1',
                        padding: '12px',
                        color: '#A9CF46'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Team 2 Section */}
              <div 
                className="animate-fade-in"
                style={{ 
                  animationDelay: '300ms',
                  border: '1px solid rgba(169, 207, 70, 0.3)',
                  borderRadius: '12px',
                  padding: '20px',
                  background: '#ffffff'
                }}
              >
                <h3 
                  className="font-semibold text-lg mb-4"
                  style={{ color: '#96C13F' }}
                >
                  Team 2
                </h3>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold" style={{ color: '#0F2E33' }}>
                      Player 1
                    </Label>
                    <PlayerCombobox
                      players={players}
                      value={team2Player1}
                      onValueChange={setTeam2Player1}
                      placeholder="Search player..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold" style={{ color: '#0F2E33' }}>
                      Player 2
                    </Label>
                    <PlayerCombobox
                      players={players}
                      value={team2Player2}
                      onValueChange={setTeam2Player2}
                      placeholder="Search player..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label 
                      htmlFor="team2Score"
                      className="text-sm font-semibold"
                      style={{ color: '#0F2E33' }}
                    >
                      Team 2 Score
                    </Label>
                    <Input
                      id="team2Score"
                      type="number"
                      min="0"
                      value={team2Score}
                      onChange={(e) => setTeam2Score(e.target.value)}
                      required
                      className="text-2xl font-bold text-center transition-all duration-200"
                      style={{
                        background: '#F8FBF6',
                        borderRadius: '12px',
                        border: '1px solid #DCE8D1',
                        padding: '12px',
                        color: '#96C13F'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button 
                type="submit" 
                className="w-full font-semibold text-base py-6 transition-all duration-200 hover-scale sticky bottom-4 z-10"
                disabled={loading}
                style={{
                  background: 'linear-gradient(90deg, #A9CF46 0%, #96C13F 100%)',
                  borderRadius: '10px',
                  color: '#0F2E33',
                  boxShadow: '0 2px 8px rgba(169, 207, 70, 0.2)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(169, 207, 70, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 2px 8px rgba(169, 207, 70, 0.2)';
                }}
              >
                {loading ? "Processing..." : "Next: Review & Confirm Match →"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <MatchConfirmationDialog
        open={showConfirmation}
        onOpenChange={setShowConfirmation}
        matchData={matchData}
        onSuccess={handleConfirmationSuccess}
      />
    </div>
  );
};

export default NewMatch;
