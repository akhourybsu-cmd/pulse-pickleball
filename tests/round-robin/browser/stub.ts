// In-memory fixtures. This module never imports a real backend or credentials.
const params = new URLSearchParams(window.location.search);
const players = ['Alex Morgan', 'Jordan Lee', 'Sam Rivera', 'Taylor Chen', 'Casey Brooks', 'Jamie Park', 'Drew Ellis', 'Riley Quinn'].map((name, i) => ({ id: `player-${i}`, full_name: name, display_name: name, gender: i % 2 ? 'female' : 'male', avatar_url: null, current_rating: 3.5 + i / 10 }));
export const writes: { table: string; data: unknown }[] = [];
export const useFriends = () => ({ friends: players.map(profile => ({ profile })), loading: false });
export const useGroupMembers = () => ({ members: players.map(profile => ({ profile })), loading: false });
export const useRecentCoPlayers = () => ({ data: players.slice(0, 4), isLoading: false });
export const useAdminGroups = () => ({ adminGroups: params.has('no-groups') ? [] : [{ id: 'group-one', name: 'Sunday Court Club' }, { id: 'group-two', name: 'The Golden Hour Crew' }], loading: false });
const guests: { id: string; display_name: string; gender: string | null }[] = [];
export const supabase = {
 auth: { getUser: async () => ({ data: { user: { id: 'preview-host' } } }) },
 functions: { invoke: async (_name: string, { body }: { body: { action: string } }) => ({ data: body.action === 'search' ? { suggestions: [{ placeId: 'preview-city', label: 'Boston, MA', primary: 'Boston', secondary: 'MA, USA' }] } : { placeId: 'preview-city', city: 'Boston', state: 'MA', name: 'Boston', country: 'USA' }, error: null }) },
 from: (table: string) => {
  let inserted: Record<string, unknown> | null = null;
  const result = () => ({ data: inserted ? { ...inserted, id: table === 'guest_players' ? `guest-${guests.length}` : 'preview-event', invite_code: 'QA-DEMO' } : table === 'profiles_public' ? players : table === 'guest_players' ? guests : [], error: null });
  const chain = {
   select: () => chain, order: () => chain, eq: () => chain, or: () => chain, limit: () => chain,
   insert: (data: Record<string, unknown>) => { inserted = data; writes.push({ table, data }); if (table === 'guest_players') guests.push({ id: `guest-${guests.length+1}`, display_name: String(data.display_name), gender: data.gender as string | null }); return chain; },
   single: async () => result(),
   then: (resolve: (value: ReturnType<typeof result>) => unknown) => Promise.resolve(result()).then(resolve),
  };
  return chain;
 },
};
