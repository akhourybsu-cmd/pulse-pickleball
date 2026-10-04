const params = new URLSearchParams(window.location.search);
const profile: Record<string, any> = {
  first_name: "Alex",
  last_name: "Player",
  name_locked: true,
  phone_number: null,
  date_of_birth: null,
  gender: null,
  skill_level_self: null,
  handedness: null,
  play_side: null,
  discoverable_by_location: false,
  location_lat: null,
  location_lng: null,
  location_name: null,
  location_place_id: null,
  id: "sample-player",
  display_name: "AlexandriaSuperLongUnbrokenFamilyName",
  full_name: null,
  avatar_url: null,
  current_rating: 4.25,
  total_matches: 1234,
  wins: 1000,
  losses: 234,
  town: "AReallyLongUnbrokenTownNameForResponsiveTesting",
  state: "Massachusetts",
};
if (params.has("short-name")) {
  profile.display_name = "Alex Player";
  profile.town = "Boston";
}
if (params.has("marketing")) {
  profile.total_matches = 47;
  profile.wins = 29;
  profile.losses = 18;
}
const assessment = params.has("completed")
  ? { self_assessed_level: 4.25, self_assessed_band: "Intermediate" }
  : null;
export const isPlatformAdmin = async () => !params.has("member");
export const isSkillAssessmentEnabled = () => !params.has("no-assessment");
export const useAuthState = () => ({
  user: { id: profile.id, email: "fixture@example.test" },
  profile,
  refresh: async () => {},
  isAuthenticated: true,
});
export const getMfaStatus = async () => ({
  method: "none",
  verified: true,
  userId: profile.id,
});
export const confirmMfaSession = async () => {};
export const MFA_VERIFIED_EVENT = "pulse:mfa-verified";
export const usePushSubscription = () => ({
  state: "unsupported",
  supported: false,
  busy: false,
  error: null,
  enable: async () => false,
  disable: async () => false,
  refresh: async () => {},
});
let privacy = { dm_privacy: "friends" };
const preferences: any[] = [];
export const supabase = {
  auth: {
    getUser: async () => ({
      data: { user: { id: profile.id, email: "fixture@example.test" } },
    }),
    signOut: async () => ({ error: null }),
    getUserIdentities: async () => ({
      data: { identities: [{ id: "fixture", provider: "email" }] },
      error: null,
    }),
    linkIdentity: async () => ({
      error: new Error("Fixture: no provider redirect"),
    }),
  },
  functions: { invoke: async () => ({ data: { ok: true }, error: null }) },
  from: (table: string) => {
    let patch: any,
      single = false;
    const b: any = {
      select: () => b,
      eq: () => b,
      in: () => b,
      order: () => b,
      abortSignal: () => b,
      update: (value: any) => {
        patch = value;
        return b;
      },
      upsert: (value: any) => {
        patch = value;
        return b;
      },
      maybeSingle: () => {
        single = true;
        return b;
      },
      single: () => {
        single = true;
        return b;
      },
      then: (resolve: any, reject: any) =>
        Promise.resolve()
          .then(() => {
            if (table === "profiles") {
              if (patch) Object.assign(profile, patch);
              return { data: { ...profile }, error: null };
            }
            if (table === "user_messaging_prefs") {
              if (patch) privacy = patch;
              return { data: privacy, error: null };
            }
            if (table === "notification_preferences") {
              if (patch) {
                const prior = preferences.findIndex(
                  (p) => p.category === patch.category
                );
                if (prior >= 0) preferences.splice(prior, 1);
                preferences.push(patch);
              }
              return { data: single ? patch : [...preferences], error: null };
            }
            return { data: single ? assessment : [], error: null };
          })
          .then(resolve, reject),
    };
    return b;
  },
};
