import logo from "@/assets/pulse-logo.png";

interface ShareableStatsCardProps {
  playerName: string;
  currentRating: number;
  totalMatches: number;
  wins: number;
  losses: number;
  winRate: string;
  pointDifferential: number;
  avgOpponentRating: number;
  cardRef?: React.RefObject<HTMLDivElement>;
}

export const ShareableStatsCard = ({
  playerName,
  currentRating,
  totalMatches,
  wins,
  losses,
  winRate,
  pointDifferential,
  avgOpponentRating,
  cardRef,
}: ShareableStatsCardProps) => {
  return (
    <div
      ref={cardRef}
      className="w-[600px] bg-secondary p-8 rounded-2xl shadow-2xl"
      style={{
        background: "linear-gradient(135deg, hsl(195, 60%, 20%), hsl(195, 60%, 15%))",
      }}
    >
        {/* Header with Logo */}
        <div className="flex items-center justify-center mb-6">
          <img src={logo} alt="PULSE" className="h-14 w-auto" />
        </div>

        {/* Player Name */}
        <div className="text-center mb-8">
          <h1 className="text-white text-4xl font-bold mb-2">{playerName}</h1>
          <p className="text-white/70 text-sm">Player Stats</p>
        </div>

        {/* Main Rating */}
        <div className="bg-primary/20 backdrop-blur-sm rounded-xl p-6 mb-6 text-center border-2 border-primary">
          <p className="text-white/70 text-sm font-semibold mb-2">CURRENT RATING</p>
          <p className="text-primary text-6xl font-bold">{currentRating.toFixed(2)}</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <p className="text-white/70 text-xs font-semibold mb-1">TOTAL MATCHES</p>
            <p className="text-white text-3xl font-bold">{totalMatches}</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <p className="text-white/70 text-xs font-semibold mb-1">WIN RATE</p>
            <p className="text-primary text-3xl font-bold">{winRate}%</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <p className="text-white/70 text-xs font-semibold mb-1">RECORD</p>
            <p className="text-white text-2xl font-bold">
              {wins}W - {losses}L
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <p className="text-white/70 text-xs font-semibold mb-1">POINT DIFF</p>
            <p
              className={`text-2xl font-bold ${
                pointDifferential > 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {pointDifferential > 0 ? "+" : ""}
              {pointDifferential}
            </p>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
          <p className="text-white/70 text-xs font-semibold mb-1">AVG OPPONENT RATING</p>
          <p className="text-white text-2xl font-bold">{avgOpponentRating.toFixed(2)}</p>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-white/50 text-xs">PULSE Pickleball League</p>
        </div>
      </div>
  );
};
