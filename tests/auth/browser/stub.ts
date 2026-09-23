// Local fixture only: no network, real credentials, or writes to a backend.
const scenario = new URL(location.href).searchParams.get('scenario');
let stalled = scenario === 'session' || scenario === 'profile';
export const restoreConnection = () => { stalled = false; };
const session = { user: { id: `connection-test-${scenario}` } };
const profile = { id: session.user.id, player_state: 'active', tutorial_completed: true, full_name: 'Connection test player' };
export const supabase = {
  rpc: () => ({ abortSignal: () => Promise.resolve({ data: { userId: session.user.id, sessionId: 'fixture-session', verified: true, method: 'none' }, error: null }) }),
  auth: {
    getSession: () => stalled && scenario === 'session' ? new Promise<never>(() => {}) : Promise.resolve({ data: { session }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  from: () => {
    const query = {
      select: () => query, eq: () => query, single: () => query, abortSignal: () => query,
      then: (resolve: (value: unknown) => void) => stalled && scenario === 'profile' ? new Promise<never>(() => {}) : Promise.resolve({ data: profile, error: null }).then(resolve),
    };
    return query;
  },
};
