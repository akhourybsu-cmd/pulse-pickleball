import { Award, Trophy, Zap, Target, Users, Heart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge as BadgeUI } from "./ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/tooltip";

interface Badge {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  tier: number;
  earned_at?: string;
}

interface BadgeDisplayProps {
  badges: Badge[];
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

const BadgeItem = ({ badge }: { badge: Badge }) => {
  const tierColor = getTierColor(badge.tier);
  const categoryIcon = getCategoryIcon(badge.category);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`
            flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
            hover:scale-105 cursor-pointer ${tierColor}
          `}>
            <div className="flex items-center gap-1">
              {categoryIcon}
              <Award className="w-6 h-6" />
            </div>
            <div className="text-center">
              <div className="font-semibold text-sm">{badge.name}</div>
              {badge.tier > 1 && (
                <BadgeUI variant="outline" className="mt-1 text-xs">
                  Tier {badge.tier}
                </BadgeUI>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-semibold">{badge.name}</p>
          <p className="text-sm text-muted-foreground">{badge.description}</p>
          {badge.earned_at && (
            <p className="text-xs text-muted-foreground mt-2">
              Earned: {new Date(badge.earned_at).toLocaleDateString()}
            </p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const BadgeDisplay = ({ badges }: BadgeDisplayProps) => {
  if (badges.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5" />
            Badges & Accolades
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">
            No badges earned yet. Keep playing to unlock achievements!
          </p>
        </CardContent>
      </Card>
    );
  }

  // Group badges by category
  const badgesByCategory = badges.reduce((acc, badge) => {
    if (!acc[badge.category]) {
      acc[badge.category] = [];
    }
    acc[badge.category].push(badge);
    return acc;
  }, {} as Record<string, Badge[]>);

  const categoryNames: Record<string, string> = {
    streaks: 'Streaks & Commitment',
    ratings: 'Ratings & Progress',
    quality: 'Game Quality',
    opponent_strength: 'Giant Killers',
    duos: 'Partnerships',
    sportsmanship: 'Sportsmanship'
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5" />
          Badges & Accolades ({badges.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {Object.entries(badgesByCategory).map(([category, categoryBadges]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              {getCategoryIcon(category)}
              {categoryNames[category] || category}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {categoryBadges.map((badge) => (
                <BadgeItem key={badge.id} badge={badge} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

import { TrendingUp } from "lucide-react";
