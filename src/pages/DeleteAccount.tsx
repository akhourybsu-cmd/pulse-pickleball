import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertTriangle, Check, Loader2, Mail, Trash2 } from "lucide-react";
import { LegalPageLayout } from "@/components/legal/LegalPageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Support inbox shown as the fallback path (and for reviewers who don't sign in).
const SUPPORT_EMAIL = "support@pulspb.com";

const DELETED_DATA = [
  "Your profile, display name, avatar, and PULSE rating",
  "Your match history and skill assessments",
  "Your friends, direct messages, and group memberships",
  "Leagues, round robins, and events you joined",
  "Your login credentials — the account cannot be recovered",
];

export default function DeleteAccount() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setEmail(data.user?.email ?? null);
      setChecking(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-account", {
        method: "POST",
      });
      if (error || (data && (data as { error?: string }).error)) {
        throw new Error((data as { message?: string })?.message || error?.message || "Deletion failed");
      }
      // Account is gone — clear the local session and show confirmation.
      await supabase.auth.signOut();
      setDone(true);
    } catch (e) {
      console.error("Account deletion failed:", e);
      toast.error(
        `We couldn't delete your account automatically. Please email ${SUPPORT_EMAIL} and we'll remove it within 30 days.`,
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <LegalPageLayout title="Delete your account">
      {/* Success state */}
      {done ? (
        <Card>
          <CardContent className="flex flex-col items-center text-center py-12">
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mb-4">
              <Check className="h-7 w-7 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold mb-1 font-display">Your account has been deleted</h2>
            <p className="text-sm text-muted-foreground max-w-sm mb-6">
              Your PULSE account and associated data have been removed. Any residual copies in
              backups are purged within 30 days. Thanks for playing.
            </p>
            <Button onClick={() => navigate("/")} className="rounded-full">Return to PULSE</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* What gets deleted */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
                <CardTitle>What deletion removes</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Deleting your account is <strong>permanent and cannot be undone</strong>. It removes:
              </p>
              <ul className="space-y-2">
                {DELETED_DATA.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
                    <span className="text-foreground/90">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground mt-4">
                Some records required by law (e.g. transaction/payment receipts) may be retained in
                anonymized form as described in our{" "}
                <Link to="/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy Policy</Link>.
              </p>
            </CardContent>
          </Card>

          {/* Action — depends on whether they're signed in */}
          {checking ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : email ? (
            <Card className="border-destructive/30">
              <CardHeader>
                <CardTitle className="text-base">Confirm deletion</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  You're signed in as <strong className="text-foreground">{email}</strong>. To
                  permanently delete this account, type <strong>DELETE</strong> below.
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  aria-label="Type DELETE to confirm"
                  autoComplete="off"
                />
                <Button
                  variant="destructive"
                  className="w-full h-11 gap-2"
                  disabled={confirmText.trim().toUpperCase() !== "DELETE" || deleting}
                  onClick={handleDelete}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Deleting…
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" /> Permanently delete my account
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                  This takes effect immediately and cannot be reversed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Sign in to delete your account</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  For your security, deletion must be done from your own signed-in account. Sign in,
                  then return to this page (or use <strong>Profile → Delete account</strong> in the app).
                </p>
                <Button onClick={() => navigate("/auth")} className="w-full h-11">Sign in</Button>
                <div className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground">
                  <Mail className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Can't sign in? Email{" "}
                    <a href={`mailto:${SUPPORT_EMAIL}?subject=Account%20deletion%20request`} className="underline underline-offset-2 hover:text-foreground">
                      {SUPPORT_EMAIL}
                    </a>{" "}
                    from your account's email address and we'll delete your account and data within 30 days.
                  </span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </LegalPageLayout>
  );
}
