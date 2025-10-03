import { useState } from "react";
import { Award, Trophy, Zap, Target, Users, Heart, TrendingUp } from "lucide-react";
import { Badge as BadgeUI } from "./ui/badge";

interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  tier: number;
  icon?: string;
  earned_at?: string;
}

interface FlippableBadgeProps {
  badge: Badge;
}

const getCategoryIcon = (category: string) => {
  switch (category) {
    case 'streaks':
      return <Zap className="w-4 h-4" />;
    case 'ratings':
      return <TrendingUp className="w-4 h-4" />;
    case 'quality':
      return <Target className="w-4 h-4" />;
    case 'opponent_strength':
      return <Trophy className="w-4 h-4" />;
    case 'duos':
      return <Users className="w-4 h-4" />;
    case 'sportsmanship':
      return <Heart className="w-4 h-4" />;
    default:
      return <Award className="w-4 h-4" />;
  }
};

const getTierColor = (tier: number) => {
  switch (tier) {
    case 1:
      return 'bg-amber-600/20 text-amber-600 border-amber-600/30';
    case 2:
      return 'bg-gray-400/20 text-gray-300 border-gray-400/30';
    case 3:
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    default:
      return 'bg-primary/20 text-primary border-primary/30';
  }
};

export const FlippableBadge = ({ badge }: FlippableBadgeProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const tierColor = getTierColor(badge.tier);
  const categoryIcon = getCategoryIcon(badge.category);

  return (
    <div 
      className="flip-card cursor-pointer"
      onClick={() => setIsFlipped(!isFlipped)}
      style={{ perspective: '1000px' }}
    >
      <div 
        className={`flip-card-inner ${isFlipped ? 'flipped' : ''}`}
        style={{
          position: 'relative',
          width: '100%',
          height: '120px',
          transition: 'transform 0.6s',
          transformStyle: 'preserve-3d',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front Side */}
        <div
          className={`flip-card-front ${tierColor}`}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
          }}
        >
          <div className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 h-full">
            {badge.icon ? (
              <div className="text-4xl">{badge.icon}</div>
            ) : (
              <div className="flex items-center gap-1">
                {categoryIcon}
                <Award className="w-6 h-6" />
              </div>
            )}
            <div className="text-center">
              <div className="font-semibold text-sm">{badge.name}</div>
              {badge.tier > 1 && (
                <BadgeUI variant="outline" className="mt-1 text-xs">
                  Tier {badge.tier}
                </BadgeUI>
              )}
            </div>
          </div>
        </div>

        {/* Back Side */}
        <div
          className={`flip-card-back ${tierColor}`}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="flex flex-col justify-center p-4 rounded-lg border-2 h-full text-xs">
            <div className="flex items-center gap-1 mb-2">
              {categoryIcon}
              <span className="font-semibold">{badge.name}</span>
            </div>
            <p className="text-xs leading-relaxed mb-2">{badge.description}</p>
            {badge.earned_at && (
              <p className="text-xs opacity-70 mt-auto">
                Earned: {new Date(badge.earned_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
