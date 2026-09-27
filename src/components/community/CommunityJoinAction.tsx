import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthState } from "@/hooks/useAuthState";
import type { Group, GroupMember } from "@/hooks/useGroups";
import { supabase } from "@/integrations/supabase/client";
import { withAuthDeadline } from "@/lib/authDeadline";

/** The same join action works after signup from a public community or venue link. */
export function CommunityJoinAction({
  group,
  membership,
}: {
  group: Group;
  membership: GroupMember | null;
}) {
  const { user } = useAuthState();
  const cache = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<string | null>(null);
  const status =
    membership?.status === "banned"
      ? "banned"
      : confirmed || membership?.status;
  if (status === "active") return null;
  if (status === "pending")
    return (
      <p role="status" className="text-sm leading-6 text-muted-foreground">
        Your join request is pending approval.
      </p>
    );
  if (status === "banned")
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        This account cannot join this community. Contact a community admin.
      </p>
    );
  if (group.visibility !== "public" || group.join_method === "invite_only")
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Ask a member for an invitation link to join this community.
      </p>
    );

  const join = async () => {
    if (!user || busy) return;
    setBusy(true);
    setError("");
    try {
      const expected =
        group.join_method === "request_to_join" ? "pending" : "active";
      const result = await withAuthDeadline((signal) =>
        supabase
          .from("group_members")
          .insert({
            group_id: group.id,
            user_id: user.id,
            role: "member",
            status: expected,
          })
          .abortSignal(signal)
      );
      if (result.error && result.error.code !== "23505") throw result.error;
      if (result.error?.code === "23505") {
        // A duplicate row can also be pending or banned; it is not proof of membership.
        const existing = await withAuthDeadline((signal) =>
          supabase
            .from("group_members")
            .select("status")
            .eq("group_id", group.id)
            .eq("user_id", user.id)
            .abortSignal(signal)
            .maybeSingle()
        );
        if (
          existing.error ||
          !existing.data ||
          !["active", "pending", "banned"].includes(existing.data.status)
        )
          throw new Error("Membership not confirmed");
        setConfirmed(existing.data.status);
      } else setConfirmed(expected);
      void cache.invalidateQueries({ queryKey: ["group-detail", group.id] });
    } catch {
      setError("We couldn’t confirm your membership. Please try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      {error && (
        <p role="alert" className="text-sm leading-5 text-destructive">
          {error}
        </p>
      )}
      <Button
        onClick={() => void join()}
        disabled={busy || !user}
        className="min-h-11 w-full gap-2"
      >
        <UserPlus className="h-4 w-4" />
        {busy
          ? "Joining…"
          : group.join_method === "request_to_join"
          ? "Request to join"
          : "Join the community"}
      </Button>
    </div>
  );
}
