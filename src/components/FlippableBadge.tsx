import { useState } from "react";
import { Award, Trophy, Zap, Target, Users, Heart, TrendingUp } from "lucide-react";
import { Badge as BadgeUI } from "./ui/badge";

// Badge image imports
import firstGameImg from "@/assets/badges/first_game.png";
import dailyGrinder1Img from "@/assets/badges/daily_grinder_1.png";
import dailyGrinder2Img from "@/assets/badges/daily_grinder_2.png";
import dailyGrinder3Img from "@/assets/badges/daily_grinder_3.png";
import weeklyWarriorImg from "@/assets/badges/weekly_warrior.png";
import courtHopperImg from "@/assets/badges/court_hopper.png";
import fastConfirmerImg from "@/assets/badges/fast_confirmer.png";
import earlyBirdImg from "@/assets/badges/early_bird.png";
import nightOwlImg from "@/assets/badges/night_owl.png";
import ironDayImg from "@/assets/badges/iron_day.png";
import partnerExplorer1Img from "@/assets/badges/partner_explorer_1.png";
import partnerExplorer2Img from "@/assets/badges/partner_explorer_2.png";
import socialButterfly1Img from "@/assets/badges/social_butterfly_1.png";
import socialButterfly2Img from "@/assets/badges/social_butterfly_2.png";
import socialButterfly3Img from "@/assets/badges/social_butterfly_3.png";
import overThreeClubImg from "@/assets/badges/over_three_club.png";
import hotHandImg from "@/assets/badges/hot_hand.png";
import slumpBusterImg from "@/assets/badges/slump_buster.png";
import rockSolidImg from "@/assets/badges/rock_solid.png";
import riser1Img from "@/assets/badges/riser_1.png";
import steadyThreeFiveImg from "@/assets/badges/steady_three_five.png";
import riser2Img from "@/assets/badges/riser_2.png";
import steadyFourOhImg from "@/assets/badges/steady_four_oh.png";
import riser3Img from "@/assets/badges/riser_3.png";
import lockdownImg from "@/assets/badges/lockdown.png";
import shutoutImg from "@/assets/badges/shutout.png";
import nailBiterImg from "@/assets/badges/nail_biter.png";
import marathonImg from "@/assets/badges/marathon.png";
import daySweeperImg from "@/assets/badges/day_sweeper.png";
import upsetAlertImg from "@/assets/badges/upset_alert.png";
import giantKillerImg from "@/assets/badges/giant_killer.png";
import dragonSlayerImg from "@/assets/badges/dragon_slayer.png";
import dynamicDuoImg from "@/assets/badges/dynamic_duo.png";
import mentorImg from "@/assets/badges/mentor.png";
import rivalrySettledImg from "@/assets/badges/rivalry_settled.png";
import powerPairImg from "@/assets/badges/power_pair.png";
import ambassadorImg from "@/assets/badges/ambassador.png";
import cleanSheetImg from "@/assets/badges/clean_sheet.png";
import modelCitizenImg from "@/assets/badges/model_citizen.png";
import reporterImg from "@/assets/badges/reporter.png";

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

const getBadgeImage = (code: string): string | null => {
  const imageMap: Record<string, string> = {
    first_game: firstGameImg,
    daily_grinder_1: dailyGrinder1Img,
    daily_grinder_2: dailyGrinder2Img,
    daily_grinder_3: dailyGrinder3Img,
    weekly_warrior: weeklyWarriorImg,
    court_hopper: courtHopperImg,
    fast_confirmer: fastConfirmerImg,
    early_bird: earlyBirdImg,
    night_owl: nightOwlImg,
    iron_day: ironDayImg,
    partner_explorer_1: partnerExplorer1Img,
    partner_explorer_2: partnerExplorer2Img,
    social_butterfly_1: socialButterfly1Img,
    social_butterfly_2: socialButterfly2Img,
    social_butterfly_3: socialButterfly3Img,
    over_three_club: overThreeClubImg,
    hot_hand: hotHandImg,
    slump_buster: slumpBusterImg,
    rock_solid: rockSolidImg,
    riser_1: riser1Img,
    steady_three_five: steadyThreeFiveImg,
    riser_2: riser2Img,
    steady_four_oh: steadyFourOhImg,
    riser_3: riser3Img,
    lockdown: lockdownImg,
    shutout: shutoutImg,
    nail_biter: nailBiterImg,
    marathon: marathonImg,
    day_sweeper: daySweeperImg,
    upset_alert: upsetAlertImg,
    giant_killer: giantKillerImg,
    dragon_slayer: dragonSlayerImg,
    dynamic_duo: dynamicDuoImg,
    mentor: mentorImg,
    rivalry_settled: rivalrySettledImg,
    power_pair: powerPairImg,
    ambassador: ambassadorImg,
    clean_sheet: cleanSheetImg,
    model_citizen: modelCitizenImg,
    reporter: reporterImg,
  };
  
  return imageMap[code] || null;
};

const getTierColor = (tier: number) => {
  switch (tier) {
    case 1:
      return 'bg-gradient-to-br from-amber-900/40 to-amber-700/30 text-amber-100 border-amber-500/50 shadow-lg shadow-amber-500/20';
    case 2:
      return 'bg-gradient-to-br from-slate-700/40 to-slate-500/30 text-slate-100 border-slate-400/50 shadow-lg shadow-slate-400/20';
    case 3:
      return 'bg-gradient-to-br from-yellow-600/40 to-yellow-400/30 text-yellow-100 border-yellow-400/50 shadow-lg shadow-yellow-400/30';
    default:
      return 'bg-primary/20 text-primary border-primary/30';
  }
};

export const FlippableBadge = ({ badge }: FlippableBadgeProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const tierColor = getTierColor(badge.tier);
  const categoryIcon = getCategoryIcon(badge.category);
  const badgeImage = getBadgeImage(badge.code);

  return (
    <div 
      className="flip-card cursor-pointer w-32 h-32 mx-auto"
      onClick={() => setIsFlipped(!isFlipped)}
      style={{ perspective: '1000px' }}
    >
      <div 
        className={`flip-card-inner ${isFlipped ? 'flipped' : ''}`}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
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
          <div className="flex flex-col items-center justify-center gap-2 p-3 rounded-full border-2 w-full h-full backdrop-blur-sm">
            {badgeImage ? (
              <div className="relative w-16 h-16 flex-shrink-0">
                <img 
                  src={badgeImage} 
                  alt={badge.name}
                  className="w-full h-full object-contain drop-shadow-lg"
                />
              </div>
            ) : badge.icon ? (
              <div className="text-3xl drop-shadow-md">{badge.icon}</div>
            ) : (
              <div className="flex items-center gap-1 drop-shadow-md">
                {categoryIcon}
                <Award className="w-5 h-5" />
              </div>
            )}
            <div className="text-center">
              <div className="font-bold text-[10px] leading-tight drop-shadow-sm px-1">{badge.name}</div>
              {badge.tier > 1 && (
                <div className="mt-0.5 text-[8px] font-semibold opacity-90">
                  Tier {badge.tier}
                </div>
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
          <div className="flex flex-col justify-center items-center p-3 rounded-full border-2 w-full h-full backdrop-blur-sm text-center">
            <div className="flex items-center gap-1 mb-1">
              {categoryIcon}
              <span className="font-bold text-[10px] drop-shadow-sm">{badge.name}</span>
            </div>
            <p className="text-[9px] leading-tight mb-1 opacity-95 px-2">{badge.description}</p>
            {badge.earned_at && (
              <p className="text-[8px] opacity-75 font-medium">
                {new Date(badge.earned_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
