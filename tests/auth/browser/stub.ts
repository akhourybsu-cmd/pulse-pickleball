// Local fixture only: no network, real credentials, or writes to a backend.
const scenario = new URL(location.href).searchParams.get('scenario');
let stalled = scenario === 'session' || scenario === 'profile';
export const restoreConnection = () => { stalled = false; };
const session = { user: { id: `connection-test-${scenario}` } };
const profile = { id: session.user.id, player_state: 'active', tutorial_completed: true, full_name: 'Connection test player' };
const listeners = new Set<(event: string, value: typeof session) => void>();
let unavailable = false;
export const resumeSession = (event = 'SIGNED_IN') => {
  listeners.forEach(listener => listener(event, structuredClone(session)));
};
export const resumeOffline = () => { unavailable = true; resumeSession(); };
export const reconnectSession = () => { unavailable = false; resumeSession(); };
export const supabase = {
  rpc: () => ({ abortSignal: () => Promise.resolve(unavailable
    ? { data: null, error: { message: 'Simulated service unavailable' }, status: 503 }
    : { data: { userId: session.user.id, sessionId: 'fixture-session', verified: true, method: 'none' }, error: null, status: 200 }) }),
  auth: {
    getSession: () => stalled && scenario === 'session' ? new Promise<never>(() => {}) : Promise.resolve({ data: { session }, error: null }),
    onAuthStateChange: (listener: (event: string, value: typeof session) => void) => {
      listeners.add(listener);
      return { data: { subscription: { unsubscribe() { listeners.delete(listener); } } } };
    },
  },
  from: () => {
    const query = {
      select: () => query, eq: () => query, single: () => query, abortSignal: () => query,
      then: (resolve: (value: unknown) => void) => stalled && scenario === 'profile' ? new Promise<never>(() => {}) : Promise.resolve({ data: profile, error: null }).then(resolve),
    };
    return query;
  },
};
