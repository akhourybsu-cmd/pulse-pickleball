import { VenueTheme } from '@/components/venue/VenueTheme';
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Loader2, MessageCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthState } from "@/hooks/useAuthState";
import { usePublicCommunity } from "@/hooks/usePublicCommunity";
import { CommunityHero } from "@/components/community/CommunityHero";
import { GuestAccountPrompt } from "@/components/community/GuestAccountPrompt";
import { Button } from "@/components/ui/button";
import {
  clearPostAuthRedirect,
  stashPostAuthRedirect,
} from "@/lib/authRedirect";
import { communityInvitePath, communityPath } from "@/lib/communityShare";
import { withAuthDeadline } from "@/lib/authDeadline";

interface InvitePreview {
  id: string;
  name: string;
  description: string | null;
  visibility: string;
  join_method: string;
  member_count: number;
  icon_url: string | null;
  cover_url: string | null;
  is_expired: boolean;
}
interface JoinResult {
  status: string;
  group_id?: string;
}

export default function JoinGroupByCode() {
  const { code = "" } = useParams<{ code: string }>();
  // A second invitation in the same tab must never inherit the first one's join state.
  return <CommunityInvitation key={code} code={code} />;
}

export function CommunityInvitation({ code }: { code: string }) {
  const { isAuthenticated, user } = useAuthState();
  const navigate = useNavigate();
  const cache = useQueryClient();
  const path = communityInvitePath(code);
  const preview = useQuery({
    queryKey: ["community-invitation", code],
    retry: false,
    staleTime: 30_000,
    queryFn: async () => {
      if (!code.trim()) return null;
      const { data, error } = await withAuthDeadline((signal) =>
        supabase
          .rpc("find_group_by_invite_code", { p_code: code })
          .abortSignal(signal)
      );
      if (error) throw error;
      return ((Array.isArray(data) ? data[0] : data) ??
        null) as InvitePreview | null;
    },
  });
  const group = preview.data;
  // Enrich only from the existing public projection, never from private group tables.
  const publicPage = usePublicCommunity(
    group && !group.is_expired ? group.id : undefined
  );
  const [result, setResult] = useState<JoinResult | null>(null);
  const [joinError, setJoinError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const joining = useRef<{ key: string; promise: Promise<JoinResult> } | null>(
    null
  );
  useEffect(() => {
    if (!isAuthenticated || !user?.id || !group || group.is_expired) return;
    let active = true;
    const key = `${user.id}:${code}:${attempt}`;
    setJoinError("");
    setResult(null);
    // Reuse an in-flight join under StrictMode; only an explicit retry issues another write.
    if (joining.current?.key !== key)
      joining.current = {
        key,
        promise: (async () => {
          const { data, error } = await withAuthDeadline((signal) =>
            supabase
              .rpc("join_group_by_code", { p_code: code })
              .abortSignal(signal)
          );
          if (error) throw error;
          return data as unknown as JoinResult;
        })(),
      };
    joining.current.promise
      .then((response) => {
        if (!active) return;
        if (
          ["joined", "already_member", "pending"].includes(response?.status) &&
          response.group_id === group.id
        ) {
          setResult(response);
          void cache.invalidateQueries({
            queryKey: ["group-detail", group.id],
          });
          if (response.status !== "pending") {
            // Keep the handoff until the actual group route acknowledges arrival.
            const destination = communityPath(group.id);
            stashPostAuthRedirect(destination);
            navigate(destination, { replace: true });
          } else clearPostAuthRedirect(path);
        } else {
          const messages: Record<string, string> = {
            expired:
              "This invitation has expired. Ask a community admin for a new link.",
            banned:
              "This account cannot join this community. Contact a community admin.",
            not_found:
              "This invitation is no longer available. Ask a member for a new link.",
          };
          setJoinError(
            messages[response?.status] ||
              "We couldn’t confirm your membership. Please try again."
          );
        }
      })
      .catch(() => {
        if (active)
          setJoinError(
            "We couldn’t confirm your membership. Check your connection and try again."
          );
      });
    return () => {
      active = false;
    };
  }, [isAuthenticated, user?.id, group, code, path, attempt, cache, navigate]);

  if (preview.isLoading)
    return (
      <p role="status" className="flex items-center justify-center gap-3 py-16">
        <Loader2 className="h-5 w-5 animate-spin" />
        Opening your community…
      </p>
    );
  if (preview.isError)
    return (
      <section role="alert" className="space-y-4 py-12">
        <h1 className="text-2xl font-semibold">Let’s try that again</h1>
        <p className="text-muted-foreground">
          We couldn’t load the community. Your invitation is still here.
        </p>
        <Button onClick={() => void preview.refetch()}>Try again</Button>
      </section>
    );
  if (!group || group.is_expired)
    return (
      <section className="space-y-4 py-12">
        <h1 className="text-2xl font-semibold">
          {group?.is_expired
            ? "This invitation has expired"
            : "Invitation not available"}
        </h1>
        <p className="text-muted-foreground">
          Ask a member for a new invitation link.
        </p>
        <Button asChild variant="outline">
          <Link to="/player/community">Explore communities</Link>
        </Button>
      </section>
    );
  const detail = publicPage.data;
  const name = detail?.venue?.name || group.name;
  const pending = result?.status === "pending";
  return (
    <VenueTheme brand={detail?.venue} className="mx-auto w-full min-w-0 max-w-6xl space-y-5">
      <CommunityHero
        group={{
          ...group,
          venue: detail?.venue || null,
          is_venue_verified: detail?.is_venue_verified || false,
        }}
        inviteCode={code}
      />
      {!isAuthenticated ? (
        <GuestAccountPrompt
          name={name}
          action={
            group.join_method === "request_to_join"
              ? "request to join this community"
              : "accept your invitation and join the community"
          }
          returnTo={path}
        />
      ) : (
        <section
          className="space-y-3 rounded-2xl border bg-card p-5"
          aria-live="polite"
        >
          <h2 className="text-lg font-semibold">
            {joinError
              ? "Couldn’t complete your request"
              : pending
              ? "Your request has been sent"
              : "Opening your community…"}
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {joinError ||
              (pending
                ? "A community admin needs to approve your request before you can take part."
                : "We’re confirming your membership and taking you to the community.")}
          </p>
          {joinError && (
            <Button onClick={() => setAttempt((value) => value + 1)}>
              Try again
            </Button>
          )}
          {pending && (
            <Button asChild variant="outline">
              <Link to="/player/community">Explore communities</Link>
            </Button>
          )}
        </section>
      )}
      <section className="rounded-2xl border bg-card p-5 sm:p-7">
        <h2 className="text-xl font-semibold [overflow-wrap:anywhere]">
          {detail?.venue?.welcome_headline || `Welcome to ${name}`}
        </h2>
        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-muted-foreground [overflow-wrap:anywhere]">
          {detail?.venue?.welcome_message ||
            group.description ||
            "Connect with local players and make more time for pickleball."}
        </p>
        {group.join_method === "request_to_join" && (
          <p className="mt-3 text-xs text-muted-foreground">
            Membership requires community approval.
          </p>
        )}
      </section>
      <section
        className="grid gap-3 sm:grid-cols-3"
        aria-label="Inside the community"
      >
        {[
          {
            icon: Users,
            title: "Find your people",
            text: "Connect with fellow players.",
          },
          {
            icon: CalendarDays,
            title: "Get on court",
            text: "Discover community games and events.",
          },
          {
            icon: MessageCircle,
            title: "Stay connected",
            text: "Catch up on posts and conversations.",
          },
        ].map((item) => (
          <div
            key={item.title}
            className="flex items-start gap-3 rounded-2xl border p-4"
          >
            <item.icon className="mt-1 h-5 w-5 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">{item.title}</h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {item.text}
              </p>
            </div>
          </div>
        ))}
      </section>
    </VenueTheme>
  );
}
