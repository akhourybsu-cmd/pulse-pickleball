const params = new URLSearchParams(window.location.search);
const profile = {
  id: 'sample-player', display_name: 'AlexandriaSuperLongUnbrokenFamilyName',
  full_name: null, avatar_url: null, current_rating: 4.25,
  total_matches: 1234, wins: 1000, losses: 234,
  town: 'AReallyLongUnbrokenTownNameForResponsiveTesting', state: 'Massachusetts',
};
if (params.has('short-name')) {
  profile.display_name = 'Alex Player';
  profile.town = 'Boston';
}
if (params.has('marketing')) {
  profile.total_matches = 47; profile.wins = 29; profile.losses = 18;
}
const assessment = params.has('completed') ? { self_assessed_level: 4.25, self_assessed_band: 'Intermediate' } : null;
export const isPlatformAdmin = async () => !params.has('member');
export const isSkillAssessmentEnabled = () => !params.has('no-assessment');
export const supabase = {
  auth: { getUser: async () => ({ data: { user: { id: profile.id } } }), signOut: async () => ({}) },
  from: (table: string) => ({ select: () => ({ eq: () => ({
    maybeSingle: async () => ({ data: table === 'profiles' ? profile : assessment }),
    single: async () => ({ data: profile }),
  }) }) }),
};
