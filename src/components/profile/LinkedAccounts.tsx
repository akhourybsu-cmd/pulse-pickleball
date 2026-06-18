import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Link2, Unlink, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Provider = "google" | "apple";

const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "apple", label: "Apple" },
];

export function LinkedAccounts() {
  const [identities, setIdentities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Provider | null>(null);

  const refresh = async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.getUserIdentities();
    if (!error && data) setIdentities(data.identities ?? []);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const isLinked = (p: Provider) => identities.some((i) => i.provider === p);

  const handleLink = async (p: Provider) => {
    setBusy(p);
    try {
      const { data, error } = await supabase.auth.linkIdentity({
        provider: p,
        options: { redirectTo: `${window.location.origin}/profile` },
      });
      if (error) throw error;
      // Browser redirects to provider; no further action needed
      if (!data?.url) await refresh();
    } catch (e: any) {
      toast({
        title: `Could not link ${p}`,
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
      setBusy(null);
    }
  };

  const handleUnlink = async (p: Provider) => {
    const identity = identities.find((i) => i.provider === p);
    if (!identity) return;
    if (identities.length <= 1) {
      toast({
        title: "Cannot unlink",
        description: "You must keep at least one sign-in method.",
        variant: "destructive",
      });
      return;
    }
    setBusy(p);
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) throw error;
      toast({ title: `${p} unlinked` });
      await refresh();
    } catch (e: any) {
      toast({
        title: `Could not unlink ${p}`,
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked Sign-In Accounts</CardTitle>
        <CardDescription>
          Link Google or Apple so you can sign in faster next time.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {PROVIDERS.map((p, idx) => {
          const linked = isLinked(p.id);
          return (
            <div key={p.id}>
              {idx > 0 && <Separator className="mb-4" />}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium flex items-center gap-2">
                    {p.label}
                    {linked && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-600">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Linked
                      </span>
                    )}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {linked
                      ? `Sign in with your ${p.label} account`
                      : `Link your ${p.label} account to this profile`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  disabled={loading || busy === p.id}
                  onClick={() => (linked ? handleUnlink(p.id) : handleLink(p.id))}
                >
                  {linked ? (
                    <>
                      <Unlink className="w-4 h-4 mr-2" />
                      {busy === p.id ? "Unlinking..." : "Unlink"}
                    </>
                  ) : (
                    <>
                      <Link2 className="w-4 h-4 mr-2" />
                      {busy === p.id ? "Linking..." : "Link"}
                    </>
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
