import { useSyncExternalStore } from "react";
let signedIn = false;
let failedPreview = false;
const listeners = new Set<() => void>();
export const actions: string[] = [];
export function signIn() {
  signedIn = true;
  listeners.forEach((fn) => fn());
}
export function useAuthState() {
  const authenticated = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
    () => signedIn
  );
  return {
    isAuthenticated: authenticated,
    user: authenticated ? { id: "test-player" } : null,
    loading: false,
  };
}
export const supabase = {
  rpc(name: string, args: { p_code?: string; _handle?: string }) {
    const result = new Promise((resolve, reject) =>
      setTimeout(() => {
        if (name === "lookup_player_by_handle") {
          resolve({ data: [{ id: "test-player" }], error: null });
          return;
        }
        if (name === "find_league_by_invite_code") {
          if (args.p_code === "RETRY" && !failedPreview) {
            failedPreview = true;
            reject(new TypeError("Offline"));
            return;
          }
          resolve({
            data:
              args.p_code === "INVALID"
                ? []
                : [
                    {
                      id: args.p_code,
                      name: "Courtside Autumn Individual Doubles Ladder",
                      description:
                        "Five weeks of great games, new partners and friendly competition.",
                      location: "Rally House · North courts",
                      league_type: "ladder",
                      registration_open: args.p_code !== "CLOSED",
                      registration_closes_at: "2027-02-01",
                      branding: {
                        primary_color: "#2563eb",
                        secondary_color: "#172554",
                        accent_color: "#67e8f9",
                        logo_url: "/pulse-icon-192.png",
                        cover_url: "/venues/rally-haus/facility-preview.png",
                      },
                    },
                  ],
            error: null,
          });
          return;
        }
        if (name === "join_league_by_code") {
          actions.push(`Joined ${args.p_code} in the local fixture`);
          resolve({ data: args.p_code, error: null });
          return;
        }
        reject(new Error(`Fixture does not implement ${name}`));
      }, 200)
    );
    return Object.assign(result, { abortSignal: () => result });
  },
};
