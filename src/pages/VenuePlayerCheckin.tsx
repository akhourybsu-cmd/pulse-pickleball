import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Maximize, LockKeyhole, ScanLine } from "lucide-react";
import { VenueTheme } from "@/components/venue/VenueTheme";
import { VenueBrandMark } from "@/components/venue/VenueBrandMark";
import type { VenueBrand } from "@/lib/venues/branding";
import { useAuthState } from "@/hooks/useAuthState";
import { supabase } from "@/integrations/supabase/client";
import { venueRpc as rpc } from "@/lib/venues/customerRecords";
import { Button } from "@/components/ui/button";
import { VenueVisitContent } from "./VenueVisit";
interface KioskView {
  venue_name: string;
  expires_at: string;
  timezone: string;
  group_id: string;
  brand: VenueBrand & {
    logo_url: string | null;
    logo_shape: "circle" | "square" | null;
    logo_image_fit: "cover" | "contain" | null;
  };
}
export default function VenuePlayerCheckin({
  station = false,
}: {
  station?: boolean;
}) {
  const { token = "" } = useParams();
  const auth = useAuthState();
  const client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const q = useQuery({
    queryKey: ["venue-kiosk-public", token],
    queryFn: () => rpc<KioskView>("venue_kiosk_view", { p_token: token }),
    retry: false,
    refetchInterval: 30000,
  });
  const own = useQuery({
    queryKey: ["venue-self-checkin", token, auth.user?.id],
    enabled: !station && !!auth.user && !!q.data && !q.isError,
    queryFn: () =>
      rpc<{ visit_token: string }>("venue_self_checkin_context", {
        p_token: token,
      }),
    retry: false,
  });
  const data = q.data;
  if (!station && auth.user && own.data && !q.isError)
    return <VenueVisitContent token={own.data.visit_token} />;
  return (
    <VenueTheme brand={data?.brand} className="min-h-dvh">
      <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center px-6 py-10 text-center">
        {data && (
          <VenueBrandMark
            name={data.venue_name}
            logoUrl={data.brand.logo_url}
            logoShape={data.brand.logo_shape}
            logoImageFit={data.brand.logo_image_fit}
            secondaryColor={data.brand.secondary_color}
            logoBackgroundColor={data.brand.logo_background_color}
            className="mb-6 h-28 w-28 text-[96px] sm:h-36 sm:w-36"
          />
        )}
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Welcome to
        </p>
        <h1 className="mt-3 text-3xl font-bold sm:text-5xl">
          {data?.venue_name || "Your venue"}
        </h1>
        {(error || q.error) && (
          <p
            role="alert"
            className="mt-6 max-w-xl rounded-2xl border bg-card p-5 text-lg"
          >
            {error || q.error?.message}
          </p>
        )}
        {q.isPending && (
          <p className="mt-6" role="status">
            Opening check-in…
          </p>
        )}
        {data &&
          !q.isError &&
          (station ? (
            <>
              {auth.loading ? (
                <p className="mt-6">Preparing station…</p>
              ) : auth.user ? (
                <section className="mt-8 max-w-xl rounded-2xl border bg-card p-6">
                  <LockKeyhole className="mx-auto h-8 w-8" />
                  <h2 className="mt-4 text-xl font-semibold">
                    Lock this browser for player check-in
                  </h2>
                  <p className="mt-3 text-sm text-muted-foreground">
                    This clears the PULSE sign-in from this browser, including
                    other tabs, so the kiosk cannot open staff tools. A
                    dedicated kiosk browser is recommended.
                  </p>
                  <Button
                    className="mt-5 h-12"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      setError("");
                      try {
                        const { error } = await supabase.auth.signOut({
                          scope: "local",
                        });
                        if (error) throw error;
                        client.clear();
                      } catch (e) {
                        setError(
                          e instanceof Error
                            ? e.message
                            : "Could not lock this browser."
                        );
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    {busy ? "Locking…" : "Lock browser & show player QR"}
                  </Button>
                </section>
              ) : (
                <>
                  <h2 className="mt-8 text-2xl font-semibold sm:text-3xl">
                    Scan to check in
                  </h2>
                  <p className="mt-3 max-w-lg text-base text-muted-foreground sm:text-lg">
                    Use your phone to confirm your visit and complete any
                    required venue documents.
                  </p>
                  <div className="my-8 rounded-3xl border bg-white p-6 shadow-sm">
                    <QRCodeSVG
                      value={`${window.location.origin}/venue-check-in/${token}`}
                      size={260}
                      marginSize={2}
                      level="M"
                    />
                  </div>
                  <p className="max-w-lg text-lg">
                    Need help or visiting as a guest? Please see the front desk.
                  </p>
                  <Button
                    variant="outline"
                    className="mt-8"
                    onClick={() =>
                      void document.documentElement
                        .requestFullscreen()
                        .catch(() =>
                          setError("Use your browser’s fullscreen control.")
                        )
                    }
                  >
                    <Maximize className="mr-2 h-4 w-4" />
                    Fullscreen
                  </Button>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Station closes at{" "}
                    {new Intl.DateTimeFormat("en-US", {
                      timeZone: data.timezone,
                      hour: "numeric",
                      minute: "2-digit",
                    }).format(new Date(data.expires_at))}
                  </p>
                </>
              )}
            </>
          ) : auth.loading || (own.isPending && !!auth.user) ? (
            <p className="mt-6" role="status">
              Finding your visit…
            </p>
          ) : auth.user ? (
            <section className="mt-8 max-w-lg rounded-2xl border bg-card p-6">
              <p role="alert">
                {own.error?.message || "Your visit could not be loaded."}
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <Button onClick={() => void own.refetch()}>Retry</Button>
                <Link to={`/player/community/group/${data.group_id}`}>
                  <Button variant="outline">Open venue community</Button>
                </Link>
              </div>
            </section>
          ) : (
            <section className="mt-8 max-w-lg rounded-2xl border bg-card p-6">
              <ScanLine className="mx-auto mb-4 h-8 w-8" />
              <h2 className="text-xl font-semibold">Check in for your visit</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Sign in to see your own registrations. Check-in opens one hour
                before your event or reservation.
              </p>
              <Link to="/auth" state={{ returnTo: `/venue-check-in/${token}` }}>
                <Button className="mt-5 h-12">Sign in & continue</Button>
              </Link>
              <p className="mt-4 text-sm text-muted-foreground">
                Guests can ask the front desk for a private visit link.
              </p>
            </section>
          ))}
      </main>
    </VenueTheme>
  );
}
