import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Loader2,
  UserCheck,
  AlertCircle,
  Clock,
  LogIn,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuthState } from "@/hooks/useAuthState";
import { guestErrorMessage } from "@/lib/guests";
import { clearPostAuthRedirect, stashPostAuthRedirect } from "@/lib/authRedirect";
import { Logo } from "@/components/Logo";

type InviteInfo = {
  invite_id: string;
  guest_player_id: string;
  guest_display_name: string;
  invited_email: string | null;
  status: string;
  requires_approval: boolean;
  expires_at: string;
  is_linked: boolean;
};

/** Translate raw RPC/DB errors into player-friendly messages. */
function friendlyError(raw: string): string {
  const known = guestErrorMessage(raw, "");
  if (known) return known;
  const m = raw.toLowerCase();
  if (m.includes("expired"))
    return "This invite has expired. Ask the organizer to send a new one.";
  if (m.includes("already") && m.includes("link"))
    return "This guest profile has already been linked to another account.";
  if (m.includes("already_claimed") || m.includes("already claimed"))
    return "This invite has already been used.";
  if (m.includes("invalid") || m.includes("not_found") || m.includes("not found"))
    return "This invite link isn't valid anymore.";
  if (m.includes("approval")) return "The organizer needs to approve this claim first.";
  if (m.includes("auth")) return "Please sign in to continue.";
  return "Something went wrong with this invite. Please try again or contact the organizer.";
}

export default function ClaimGuest() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const { user: authedUser, loading: authLoading } = useAuthState();
  const authReady = !authLoading;
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const [result, setResult] = useState<"linked" | "awaiting_approval" | null>(null);
  const { data: invite, isLoading: loading, error: loadError, refetch } = useQuery({
    queryKey: ["claim-guest", token], enabled: !!token,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_claim_invite", { _token: token! });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as InviteInfo | undefined;
      if (!row) throw new Error("invalid_token");
      return row;
    },
    retry: 1,
  });
  useEffect(() => {
    generation.current += 1;
    setResult(null); setError(null);
    return () => { generation.current += 1; };
  }, [token, authedUser?.id]);
  useEffect(() => {
    if (authReady && authedUser && token) clearPostAuthRedirect(`/claim-guest/${token}`);
  }, [authReady, authedUser, token]);
  const displayError = error ?? (loadError ? friendlyError(loadError.message) : !token ? "Missing invite token." : null);
  const expired = !!invite && new Date(invite.expires_at).getTime() <= Date.now();

  const handleClaim = async () => {
    if (!token || busyRef.current) return;
    busyRef.current = true; setClaiming(true);
    const current = generation.current;
    try {
      const { data, error } = await supabase.rpc("claim_guest_profile", { _token: token });
      if (error) throw error;
      const res = data as { ok?: boolean; status?: string; error?: string } | null;
      if (!res?.ok) throw new Error(res?.error ?? "invalid_response");
      if (current !== generation.current) return;
      setError(null);
      setResult(res.status === "linked" ? "linked" : "awaiting_approval");
      void qc.invalidateQueries({ queryKey: ["my-guest-players"] });
      void qc.invalidateQueries({ queryKey: ["guest-players-roster"] });
      void qc.invalidateQueries({ queryKey: ["pending-guest-claims"] });
      // Player dashboards have several event/history query keys. Mark cached
      // data stale after linking so returning to any one loads the new identity.
      if (res.status === "linked") void qc.invalidateQueries();
    } catch (error) {
      if (current === generation.current) setError(friendlyError(error instanceof Error ? error.message : "unknown"));
    } finally { busyRef.current = false; setClaiming(false); }
  };

  const buildAuthUrl = (mode: "signin" | "signup") => {
    const redirect = `/claim-guest/${token}`;
    stashPostAuthRedirect(redirect);
    const params = new URLSearchParams();
    params.set("redirect", redirect);
    if (mode === "signup") params.set("mode", "signup");
    if (invite?.invited_email) params.set("email", invite.invited_email);
    return `/auth?${params.toString()}`;
  };

  const goSignIn = () => navigate(buildAuthUrl("signin"));
  const goSignUp = () => navigate(buildAuthUrl("signup"));

  const switchAccount = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) { setError("Could not sign out. Please try again."); return; }
    navigate(buildAuthUrl("signin"));
  };

  const emailMismatch = useMemo(() => {
    if (!invite?.invited_email || !authedUser?.email) return false;
    return (
      invite.invited_email.toLowerCase() !== authedUser.email.toLowerCase()
    );
  }, [invite, authedUser]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-secondary border-b border-secondary-foreground/10">
        <div className="max-w-md mx-auto px-4 h-[64px] flex items-center justify-center">
          {/* Sized + tinted like the PlayerShell header — an unconstrained
              Logo renders at full container width (~170px tall), overflowing
              this 64px bar and bleeding over the card below. */}
          <Logo className="h-[52px] w-auto text-secondary-foreground" />
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-4">
        <Card className="w-full max-w-md p-6 space-y-5 mt-8">
          {loading || !authReady ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : displayError ? (
            <div className="text-center space-y-3 py-4">
              <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
              <h1 className="text-lg font-semibold">Can't open this invite</h1>
              <p className="text-sm text-muted-foreground">{displayError}</p>
              <Button onClick={() => { setError(null); void refetch(); }}>Try again</Button>
              <Button
                variant="outline"
                onClick={() => navigate("/")}
                className="w-full"
              >
                Back to PULSE
              </Button>
            </div>
          ) : result === "linked" ? (
            <div className="text-center space-y-3 py-4">
              <UserCheck className="h-10 w-10 mx-auto text-primary" />
              <h1 className="text-lg font-semibold">You're all set!</h1>
              <p className="text-sm text-muted-foreground">
                <strong>{invite?.guest_display_name}</strong>'s match history
                is now linked to your PULSE account.
              </p>
              <Button
                onClick={() => navigate("/player/dashboard")}
                className="w-full"
              >
                Go to dashboard
              </Button>
            </div>
          ) : result === "awaiting_approval" ? (
            <div className="text-center space-y-3 py-4">
              <Clock className="h-10 w-10 mx-auto text-amber-500" />
              <h1 className="text-lg font-semibold">Sent for approval</h1>
              <p className="text-sm text-muted-foreground">
                The organizer will review your claim. You'll see this profile
                linked once they approve.
              </p>
              <Button
                onClick={() => navigate("/player/dashboard")}
                className="w-full"
              >
                Go to dashboard
              </Button>
            </div>
          ) : invite ? (
            <>
              <div className="space-y-2 text-center">
                <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Claim your guest profile
                </p>
                <h1 className="text-xl font-semibold">
                  {invite.guest_display_name}
                </h1>
                <p className="text-sm text-muted-foreground">
                  An organizer added you as a guest player. Link this profile
                  to your PULSE account to keep your match history together.
                </p>
              </div>

              {invite.is_linked && !authedUser ? (
                <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground text-center">
                  This guest profile is already linked to an account.
                </div>
              ) : (expired && invite.status !== "accepted") || (invite.status !== "pending" && invite.status !== "awaiting_approval" && invite.status !== "accepted") ? (
                <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground text-center">
                  This invite is no longer active ({expired ? "expired" : invite.status}). Ask the organizer for a new invitation.
                </div>
              ) : !authedUser ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground text-center">
                    {invite.invited_email
                      ? "Sign in or create your account to finish linking."
                      : "Sign in or create an account to continue. The organizer will review your claim."}
                  </p>
                  <Button onClick={goSignUp} className="w-full" size="lg">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Create a PULSE account
                  </Button>
                  <Button
                    onClick={goSignIn}
                    variant="outline"
                    className="w-full"
                    size="lg"
                  >
                    <LogIn className="h-4 w-4 mr-2" />
                    I already have an account
                  </Button>
                  {invite.invited_email && (
                    <p className="text-xs text-muted-foreground text-center">
                      Use <strong>{invite.invited_email}</strong> so we can
                      link automatically.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <p className="text-muted-foreground">Signed in as</p>
                    <p className="font-medium truncate">
                      {authedUser.email ?? "Your account"}
                    </p>
                    {emailMismatch && (
                      <p className="text-xs text-amber-600 mt-1">
                        This doesn't match the invited email
                        ({invite.invited_email}). The organizer must
                        approve your claim.
                      </p>
                    )}
                  </div>

                  <Button
                    onClick={handleClaim}
                    className="w-full"
                    size="lg"
                    disabled={claiming}
                  >
                    {claiming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Linking…
                      </>
                    ) : (
                      <>Link to my account</>
                    )}
                  </Button>

                  <Button
                    onClick={switchAccount}
                    variant="ghost"
                    className="w-full"
                    disabled={claiming}
                  >
                    Use a different account
                  </Button>
                </div>
              )}

              <p className="text-[11px] text-muted-foreground text-center">
                Invites expire 30 days after they're created.
              </p>
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
