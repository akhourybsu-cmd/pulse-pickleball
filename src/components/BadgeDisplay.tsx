import { Award, Trophy, Zap, Target, Users, Heart, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { FlippableBadge } from "./FlippableBadge";

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
        <p className="text-sm text-muted-foreground mt-2">
          Click any badge to flip and see details
        </p>
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
                <FlippableBadge key={badge.id} badge={badge} />
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
