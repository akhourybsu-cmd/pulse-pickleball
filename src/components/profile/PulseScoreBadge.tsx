import { Award } from "lucide-react";

interface PulseScoreBadgeProps {
  score: number;
}

export const PulseScoreBadge = ({ score }: PulseScoreBadgeProps) => {
  const getBadgeInfo = (score: number) => {
    if (score >= 4.0) return { tier: "Emerald", color: "from-emerald-500 to-emerald-600" };
    if (score >= 3.5) return { tier: "Gold", color: "from-yellow-400 to-yellow-500" };
    if (score >= 3.0) return { tier: "Silver", color: "from-gray-300 to-gray-400" };
    return { tier: "Bronze", color: "from-orange-400 to-orange-500" };
  };

  const { tier, color } = getBadgeInfo(score);

  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r ${color} text-white text-xs font-semibold shadow-md`}>
      <Award className="w-3.5 h-3.5" />
      <span>{tier} Tier</span>
    </div>
  );
};
