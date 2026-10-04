import { useEffect, useRef, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/hooks/useAuthState";
import { withAuthDeadline } from "@/lib/authDeadline";
import {
  clearPostAuthRedirect,
  stashPostAuthRedirect,
} from "@/lib/authRedirect";
import { communityAuthUrl } from "@/lib/communityAccess";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Loader2 } from "lucide-react";
import { Logo } from "@/components/Logo";

export default function QRCheckIn() {
  const [params] = useSearchParams();
  const auth = useAuthState();
  const sessionId = params.get("session") || "";
  return (
    <SessionCheckIn
      key={`${sessionId}:${auth.user?.id || "guest"}`}
      sessionId={sessionId}
      auth={auth}
    />
  );
}

function SessionCheckIn({
  sessionId,
  auth,
}: {
  sessionId: string;
  auth: ReturnType<typeof useAuthState>;
}) {
  const navigate = useNavigate();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [checkedIn, setCheckedIn] = useState(false);
  const busyRef = useRef(false),
    active = useRef(true);
  const path = `/qr-checkin?${new URLSearchParams({ session: sessionId })}`;
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  useEffect(() => {
    if (auth.isAuthenticated) clearPostAuthRedirect(path);
  }, [auth.isAuthenticated, path]);
  const query = useQuery({
    queryKey: ["shared-session-checkin", sessionId],
    retry: false,
    queryFn: async () => {
      if (!sessionId) return null;
      const { data, error } = await withAuthDeadline((signal) =>
        supabase
          .from("sessions")
          .select("id,name,start_time,courts:court_id(name)")
          .eq("id", sessionId)
          .eq("status", "active")
          .abortSignal(signal)
          .maybeSingle()
      );
      if (error) throw error;
      return data;
    },
  });
  const findCheckIn = async () => {
    const { data, error } = await withAuthDeadline((signal) =>
      supabase
        .from("check_ins")
        .select("id")
        .eq("session_id", sessionId)
        .eq("player_id", auth.user!.id)
        .eq("status", "active")
        .abortSignal(signal)
        .maybeSingle()
    );
    if (error) throw error;
    return data;
  };
  const own = useQuery({
    queryKey: ["shared-session-attendance", sessionId, auth.user?.id],
    enabled: !!query.data && auth.isAuthenticated,
    retry: false,
    queryFn: findCheckIn,
  });
  const checkIn = async () => {
    if (busyRef.current || checkedIn || own.data || !query.data) return;
    if (!auth.isAuthenticated) {
      stashPostAuthRedirect(path);
      navigate(communityAuthUrl(path, "signin"));
      return;
    }
    busyRef.current = true;
    setBusy(true);
    setError("");
    try {
      // Recheck before writing in case another tab already checked this player in.
      if (!(await findCheckIn())) {
        const { error } = await withAuthDeadline((signal) =>
          supabase
            .from("check_ins")
            .upsert(
              {
                session_id: sessionId,
                player_id: auth.user!.id,
                status: "active",
                checked_in_at: new Date().toISOString(),
              },
              { onConflict: "session_id,player_id" }
            )
            .abortSignal(signal)
        );
        if (error && (error.code !== "23505" || !(await findCheckIn())))
          throw error;
      }
      void cache.invalidateQueries({
        queryKey: ["shared-session-attendance", sessionId],
      });
      if (active.current) setCheckedIn(true);
    } catch {
      if (active.current)
        setError("We could not confirm your check-in. Please try again.");
    } finally {
      busyRef.current = false;
      if (active.current) setBusy(false);
    }
  };
  const session = query.data;
  const loading = query.isPending || auth.loading;
  return (
    <main className="min-h-dvh flex items-center justify-center bg-background p-5">
      <Card className="w-full max-w-md overflow-hidden rounded-3xl">
        <CardHeader className="space-y-4 text-center">
          <Logo compact className="mx-auto w-24" />
          <CardTitle className="text-2xl break-words">
            {loading
              ? "Loading session"
              : query.isError
              ? "Connection interrupted"
              : !session
              ? "Session unavailable"
              : session.name}
          </CardTitle>
          {session && (
            <p className="text-sm text-muted-foreground">
              {session.courts?.name}
              {session.start_time
                ? ` · ${new Date(
                    `2000-01-01T${session.start_time}`
                  ).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}`
                : ""}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {loading ? (
            <Loader2
              aria-label="Loading session"
              className="mx-auto h-6 w-6 animate-spin"
            />
          ) : query.isError ? (
            <>
              <p role="alert" className="text-sm text-muted-foreground">
                Please retry to open this session.
              </p>
              <Button className="w-full" onClick={() => void query.refetch()}>
                Try again
              </Button>
            </>
          ) : !session ? (
            <>
              <p className="text-sm text-muted-foreground">
                This session may have ended, or the link is no longer valid. Ask
                the organizer for a current link.
              </p>
              <Button
                className="w-full"
                onClick={() => navigate("/player/dashboard")}
              >
                Go to home
              </Button>
            </>
          ) : checkedIn || own.data ? (
            <>
              <CheckCircle className="mx-auto h-14 w-14 text-green-600" />
              <p className="font-semibold">You're checked in</p>
              <p className="text-sm text-muted-foreground">
                Open the session queue to continue.
              </p>
              <Button
                className="w-full"
                onClick={() =>
                  navigate(
                    `/session/queue?${new URLSearchParams({
                      session: sessionId,
                    })}`
                  )
                }
              >
                Open session queue
              </Button>
            </>
          ) : (
            <>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
              {own.isError ? (
                <>
                  <p role="alert" className="text-sm text-muted-foreground">
                    We could not check your attendance.
                  </p>
                  <Button className="w-full" onClick={() => void own.refetch()}>
                    Retry attendance check
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {auth.isAuthenticated
                      ? "Check in when you arrive for your session."
                      : "Sign in to check in for this session."}
                  </p>
                  <Button
                    className="w-full min-h-11"
                    disabled={busy || (auth.isAuthenticated && own.isPending)}
                    onClick={() => void checkIn()}
                  >
                    {busy
                      ? "Checking in…"
                      : auth.isAuthenticated
                      ? "Check in"
                      : "Sign in to check in"}
                  </Button>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
