import logo from "@/assets/pulse-logo.png";

interface ShareableMatchCardProps {
  playerName: string;
  partnerName: string;
  opponent1Name: string;
  opponent2Name: string;
  teamScore: number;
  opponentScore: number;
  won: boolean;
  ratingChange: number;
  ratingAfter: number;
  courtName: string;
  matchDate: string;
  cardRef?: React.RefObject<HTMLDivElement>;
}

export const ShareableMatchCard = ({
  playerName,
  partnerName,
  opponent1Name,
  opponent2Name,
  teamScore,
  opponentScore,
  won,
  ratingChange,
  ratingAfter,
  courtName,
  matchDate,
  cardRef,
}: ShareableMatchCardProps) => {
  return (
    <div
      ref={cardRef}
      className="w-[600px] bg-secondary p-8 rounded-2xl shadow-2xl"
      style={{
        background: "linear-gradient(135deg, hsl(195, 60%, 20%), hsl(195, 60%, 15%))",
      }}
    >
        {/* Header with Logo */}
        <div className="flex items-center justify-between mb-6">
          <img src={logo} alt="PULSE" className="h-12 w-auto" />
          <div
            className={`px-4 py-1.5 rounded-full font-bold text-sm ${
              won ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"
            }`}
          >
            {won ? "VICTORY" : "DEFEAT"}
          </div>
        </div>

        {/* Court and Date */}
        <div className="text-center mb-6">
          <h2 className="text-white text-2xl font-bold mb-1">{courtName}</h2>
          <p className="text-white/70 text-sm">{new Date(matchDate).toLocaleDateString()}</p>
        </div>

        {/* Score Display */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 items-center mb-4">
            <div className="text-center">
              <p className="text-white/70 text-xs font-semibold mb-2">YOUR TEAM</p>
              <p className="text-white font-bold text-sm">{playerName}</p>
              <p className="text-white font-bold text-sm">{partnerName}</p>
            </div>
            <div className="text-center">
              <p className="text-white text-5xl font-bold">
                {teamScore} - {opponentScore}
              </p>
            </div>
            <div className="text-center">
              <p className="text-white/70 text-xs font-semibold mb-2">OPPONENTS</p>
              <p className="text-white font-bold text-sm">{opponent1Name}</p>
              <p className="text-white font-bold text-sm">{opponent2Name}</p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <p className="text-white/70 text-xs font-semibold mb-1">RATING CHANGE</p>
            <p
              className={`text-2xl font-bold ${
                ratingChange > 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {ratingChange > 0 ? "+" : ""}
              {ratingChange.toFixed(3)}
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <p className="text-white/70 text-xs font-semibold mb-1">NEW RATING</p>
            <p className="text-white text-2xl font-bold">{ratingAfter.toFixed(2)}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-white/50 text-xs">PULSE Pickleball League</p>
        </div>
      </div>
  );
};
