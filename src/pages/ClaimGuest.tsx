import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, UserCheck, AlertCircle, Clock } from "lucide-react";
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
  const m = raw.toLowerCase();
  if (m.includes("expired")) return "This invite has expired. Ask the organizer to send a new one.";
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
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [result, setResult] = useState<"linked" | "awaiting_approval" | null>(
    null,
  );
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    if (!token) {
      setError("Missing invite token.");
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("get_claim_invite", {
        _token: token,
      });
      if (error) setError(friendlyError(error.message));
      else if (!data || (Array.isArray(data) && data.length === 0))
        setError("We couldn't find this invite. The link may be invalid or it was revoked.");
      else setInvite(Array.isArray(data) ? (data[0] as InviteInfo) : (data as InviteInfo));
      setLoading(false);
    })();
  }, [token]);

  const handleClaim = async () => {
    if (!token) return;
    setClaiming(true);
    const { data, error } = await supabase.rpc("claim_guest_profile", {
      _token: token,
    });
    setClaiming(false);
    if (error) {
      setError(friendlyError(error.message));
      return;
    }
    const res = data as { ok: boolean; status?: string; error?: string };
    if (!res.ok) {
      setError(friendlyError(res.error ?? "Could not claim this profile."));
      return;
    }
    setResult(res.status === "linked" ? "linked" : "awaiting_approval");
  };


  const goSignIn = () => {
    const redirect = `/claim-guest/${token}`;
    navigate(`/auth?redirect=${encodeURIComponent(redirect)}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="bg-secondary border-b border-secondary-foreground/10">
        <div className="max-w-md mx-auto px-4 h-[64px] flex items-center justify-center">
          <Logo />
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-4">
        <Card className="w-full max-w-md p-6 space-y-4 mt-8">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center space-y-3 py-4">
              <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
              <h1 className="text-lg font-semibold">Can't open this invite</h1>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : result === "linked" ? (
            <div className="text-center space-y-3 py-4">
              <UserCheck className="h-10 w-10 mx-auto text-primary" />
              <h1 className="text-lg font-semibold">Profile linked!</h1>
              <p className="text-sm text-muted-foreground">
                Your guest history is now connected to your account.
              </p>
              <Button onClick={() => navigate("/player/dashboard")} className="w-full">
                Go to dashboard
              </Button>
            </div>
          ) : result === "awaiting_approval" ? (
            <div className="text-center space-y-3 py-4">
              <Clock className="h-10 w-10 mx-auto text-amber-500" />
              <h1 className="text-lg font-semibold">Sent for approval</h1>
              <p className="text-sm text-muted-foreground">
                The round robin organizer will review your claim. You'll see
                this profile linked once they approve.
              </p>
              <Button onClick={() => navigate("/player/dashboard")} className="w-full">
                Go to dashboard
              </Button>
            </div>
          ) : invite ? (
            <>
              <div className="space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Claim guest profile
                </p>
                <h1 className="text-xl font-semibold">
                  {invite.guest_display_name}
                </h1>
                {invite.invited_email && (
                  <p className="text-sm text-muted-foreground">
                    Invited: {invite.invited_email}
                  </p>
                )}
              </div>

              {invite.is_linked ? (
                <p className="text-sm text-muted-foreground">
                  This guest profile is already linked to a registered account.
                </p>
              ) : invite.status !== "pending" &&
                invite.status !== "awaiting_approval" ? (
                <p className="text-sm text-muted-foreground">
                  This invite is no longer active ({invite.status}).
                </p>
              ) : authed === false ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Sign in or create an account to claim this profile.
                  </p>
                  <Button onClick={goSignIn} className="w-full">
                    Sign in to continue
                  </Button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    {invite.requires_approval && !invite.invited_email
                      ? "This was shared as a public link, so the organizer will review your claim before it's linked."
                      : "We'll link this profile to your account."}
                  </p>
                  <Button
                    onClick={handleClaim}
                    className="w-full"
                    disabled={claiming}
                  >
                    {claiming ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Claiming…
                      </>
                    ) : (
                      "Claim this profile"
                    )}
                  </Button>
                </>
              )}
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
