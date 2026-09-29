import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, it, expect, vi } from "vitest";
const state = vi.hoisted(() => ({ lookup: vi.fn(), venue: vi.fn() }));
vi.mock("@/hooks/useAuthState", () => ({
  useAuthState: () => ({ user: { id: "owner" } }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: (key: string, id: string) => {
          state.venue(key, id);
          return {
            eq: () => ({
              order: () => ({ limit: () => ({ maybeSingle: state.lookup }) }),
            }),
          };
        },
      }),
    }),
  },
}));
import { VenuePaymentHandoff } from "@/components/venue/VenuePaymentHandoff";
let root: ReactTestRenderer;
let cache: QueryClient;
let location = "";
function Destination() {
  const loc = useLocation();
  location = loc.pathname + loc.search;
  return <p>Venue console</p>;
}
afterEach(() => {
  act(() => root?.unmount());
  cache?.clear();
  vi.clearAllMocks();
});
it.each([
  "?venue=venue-a&payment_provider=square&code=callback-code&state=venue-a%3Anonce",
  "?venue=venue-a&connect=success",
])(
  "keeps provider return parameters inside the matching venue console: %s",
  async (search) => {
    state.lookup.mockResolvedValue({ data: { id: "group-a" }, error: null });
    cache = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => {
      root = create(
        <QueryClientProvider client={cache}>
          <MemoryRouter initialEntries={["/player/payments" + search]}>
            <Routes>
              <Route
                path="/player/payments"
                element={<VenuePaymentHandoff venueId="venue-a" />}
              />
              <Route
                path="/player/community/group/:id/payments"
                element={<Destination />}
              />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>,
      );
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(state.venue).toHaveBeenCalledWith("venue_id", "venue-a");
    expect(location).toBe("/player/community/group/group-a/payments" + search);
  },
);
