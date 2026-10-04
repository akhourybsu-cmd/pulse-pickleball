import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthState } from '@/hooks/useAuthState';
import { withAuthDeadline } from '@/lib/authDeadline';
import { useRef, useState } from "react";
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
  const { user } = useAuthState();
  const client = useQueryClient();
  const [busy, setBusy] = useState<Provider | null>(null);
  const lock = useRef(false);
  const query = useQuery({
    queryKey: ['account-identities', user?.id], enabled: !!user,
    staleTime: 60_000, refetchOnWindowFocus: false, retry: false,
    queryFn: async () => {
      const { data, error } = await withAuthDeadline(() => supabase.auth.getUserIdentities());
      if (error) throw error;
      if (!data) throw new Error('Sign-in methods could not be loaded.');
      return data.identities;
    },
  });
  const identities = query.data ?? [];
  const loading = query.isLoading;
  const isLinked = (p: Provider) => identities.some((i) => i.provider === p);

  const handleLink = async (p: Provider) => {
    if (lock.current || !query.data || query.isError) return;
    lock.current = true;
    setBusy(p);
    try {
      const { data, error } = await withAuthDeadline(() => supabase.auth.linkIdentity({
        provider: p,
        options: { redirectTo: `${window.location.origin}/player/profile/security` },
      }));
      if (error) throw error;
      // Browser redirects to provider; no further action needed
      if (!data?.url) await query.refetch();
    } catch (e: any) {
      toast({
        title: `Could not link ${p}`,
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const handleUnlink = async (p: Provider) => {
    const identity = identities.find((i) => i.provider === p);
    if (!identity || lock.current || query.isError) return;
    if (identities.length <= 1) {
      toast({
        title: "Cannot unlink",
        description: "You must keep at least one sign-in method.",
        variant: "destructive",
      });
      return;
    }
    lock.current = true;
    setBusy(p);
    try {
      const { error } = await withAuthDeadline(() => supabase.auth.unlinkIdentity(identity));
      if (error) throw error;
      toast({ title: `${p} unlinked` });
      client.setQueryData(['account-identities', user?.id], identities.filter(i => i.id !== identity.id));
    } catch (e: any) {
      toast({
        title: `Could not unlink ${p}`,
        description: e?.message ?? "Please try again.",
        variant: "destructive",
      });
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  return (
    <Card data-account-card>
      <CardHeader>
        <CardTitle>Linked Sign-In Accounts</CardTitle>
        <CardDescription>
          Link Google or Apple so you can sign in faster next time.
        </CardDescription>
      </CardHeader>
      <CardContent data-account-content className="space-y-4">
        {query.isError && <p role="alert" className="text-sm">Couldn’t load your sign-in methods. <Button variant="link" onClick={() => void query.refetch()}>Try again</Button></p>}
        {PROVIDERS.map((p, idx) => {
          const linked = isLinked(p.id);
          return (
            <div key={p.id}>
              {idx > 0 && <Separator className="mb-4" />}
              <div className="flex flex-wrap items-center justify-between gap-3">
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
                  disabled={loading || !!busy || query.isError || !user || (linked && identities.length <= 1)}
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
