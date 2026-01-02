// Demo data for "Pickle Pete" - used in the Take a Tour page

export const demoProfile = {
  id: "demo-user-123",
  display_name: "Pickle Pete",
  full_name: "Pete Peterson",
  avatar_url: null,
  location: "Tampa, FL",
  current_rating: 3.47,
  week_start_rating: 3.38,
  wins: 24,
  losses: 16,
  total_matches: 40,
  total_points_for: 484,
  total_points_against: 432,
  avg_opponent_rating: 3.42,
  partners_count: 8,
  courts_played: 5,
};

export const demoHomeCourt = {
  id: "demo-court-1",
  name: "Riverside Recreation Center",
  city: "Tampa",
  state: "FL",
};

export const demoGroups = [
  { id: "group-1", name: "Tampa Bay Dinkers", memberCount: 45, type: "recreational" as const },
  { id: "group-2", name: "Riverside Courts Official", memberCount: 128, type: "venue_official" as const, verified: true },
];

export const demoMatchHistory = [
  { 
    id: "match-1",
    date: "2 days ago", 
    result: "W" as const, 
    score: "11-8, 11-6", 
    partner: "Sarah M.", 
    opponents: "Mike T. & Lisa R.",
    ratingChange: 0.04,
  },
  { 
    id: "match-2",
    date: "5 days ago", 
    result: "L" as const, 
    score: "9-11, 11-9, 8-11", 
    partner: "John D.", 
    opponents: "Chris P. & Amy K.",
    ratingChange: -0.03,
  },
  { 
    id: "match-3",
    date: "1 week ago", 
    result: "W" as const, 
    score: "11-5, 11-7", 
    partner: "Maria G.", 
    opponents: "Tom B. & Sue L.",
    ratingChange: 0.05,
  },
  { 
    id: "match-4",
    date: "1 week ago", 
    result: "W" as const, 
    score: "11-9, 11-8", 
    partner: "Sarah M.", 
    opponents: "Dave H. & Jen W.",
    ratingChange: 0.03,
  },
  { 
    id: "match-5",
    date: "2 weeks ago", 
    result: "L" as const, 
    score: "8-11, 10-12", 
    partner: "Maria G.", 
    opponents: "Chris P. & Amy K.",
    ratingChange: -0.02,
  },
];

export const demoPendingActions = [
  { 
    id: "pending-1",
    type: "match_verification" as const, 
    message: "Sarah M. submitted a match for verification", 
    time: "2h ago" 
  },
  { 
    id: "pending-2",
    type: "group_invite" as const, 
    message: "You've been invited to join 'Weekend Warriors'", 
    time: "1d ago" 
  },
];

export const demoCourtStats = [
  { id: "court-1", name: "Riverside Recreation Center", matches: 18, rating: 3.52, wins: 12, losses: 6 },
  { id: "court-2", name: "Tampa Community Courts", matches: 14, rating: 3.44, wins: 8, losses: 6 },
  { id: "court-3", name: "Sunset Park Pickleball", matches: 8, rating: 3.38, wins: 4, losses: 4 },
];

// Computed demo values
export const demoWinRate = Math.round((demoProfile.wins / demoProfile.total_matches) * 100);
export const demoPointDiff = ((demoProfile.total_points_for - demoProfile.total_points_against) / demoProfile.total_matches).toFixed(1);
export const demoWeeklyChange = demoProfile.current_rating - demoProfile.week_start_rating;
