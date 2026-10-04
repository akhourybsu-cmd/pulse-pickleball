import { useAuthState } from "@/hooks/useAuthState";
import { useEffect } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withAuthDeadline } from "@/lib/authDeadline";
import { clearPostAuthRedirect } from "@/lib/authRedirect";
import { playerProfilePath } from "@/lib/share";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

/** Compatibility for player QR codes already shared using /u/:handle. */
export default function PlayerByHandle() {
  const { handle = "" } = useParams();
  const { user } = useAuthState();
  const location = useLocation();
  const cleaned = handle.trim().replace(/^@/, "").toLowerCase();
  const query = useQuery({
    queryKey: ["shared-player-handle", user?.id, cleaned],
    retry: false,
    queryFn: async () => {
      const { data, error } = await withAuthDeadline((signal) =>
        supabase
          .rpc("lookup_player_by_handle", { _handle: cleaned })
          .abortSignal(signal)
      );
      if (error) throw error;
      if (data?.[0]?.id) return data[0].id;
      // Friend discovery deliberately excludes the viewer. A shared profile
      // link must still work when its owner scans it. Keep other players on the
      // discovery RPC so its block filtering remains intact.
      if (!user?.id) return null;
      const { data: own, error: ownError } = await withAuthDeadline(signal => supabase
        .from('profiles_public').select('id,handle').eq('id', user.id)
        .abortSignal(signal).maybeSingle());
      if (ownError) throw ownError;
      return own?.handle?.toLowerCase() === cleaned ? own.id : null;
    },
  });
  useEffect(() => {
    clearPostAuthRedirect(
      `${location.pathname}${location.search}${location.hash}`
    );
  }, [location]);
  if (query.data)
    return <Navigate to={playerProfilePath(query.data)} replace />;
  return (
    <main className="min-h-dvh grid place-items-center bg-background p-5">
      <section className="w-full max-w-md rounded-3xl border bg-card p-6 text-center space-y-4">
        <Logo compact className="mx-auto w-24" />
        <h1 className="text-xl font-semibold">
          {query.isPending
            ? "Finding your player"
            : query.isError
            ? "Connection interrupted"
            : "Player not found"}
        </h1>
        <p role="status" className="text-sm text-muted-foreground">
          {query.isPending
            ? "Opening the shared profile…"
            : query.isError
            ? "Please try again to open this profile."
            : "This handle may have changed. Ask your friend for their latest profile link."}
        </p>
        {query.isError && (
          <Button className="w-full" onClick={() => void query.refetch()}>
            Try again
          </Button>
        )}
        {!query.isPending && (
          <Button asChild variant="outline" className="w-full">
            <Link to="/player/community">Find players</Link>
          </Button>
        )}
      </section>
    </main>
  );
}
