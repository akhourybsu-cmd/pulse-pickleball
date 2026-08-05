import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, Camera, MapPin, Swords, X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Home "Getting started" checklist — the durable orientation for new users,
 * shown whether or not they went through (or skipped) the guided flow. Every
 * item is derived from the profile the dashboard already loads, so there are no
 * extra queries. The card auto-hides once all items are done, and can be
 * dismissed (persisted per-user in localStorage). Independent of
 * `tutorial_completed` on purpose — a skipper still gets oriented here.
 */
interface GettingStartedProfile {
  avatar_url?: string | null;
  town?: string | null;
  state?: string | null;
  total_matches?: number | null;
}

export function GettingStartedCard({
  userId,
  profile,
}: {
  userId?: string;
  profile: GettingStartedProfile | null;
}) {
  const storageKey = userId ? `pulse:getting-started-dismissed:${userId}` : null;
  // Read persistence synchronously each render (cheap). Doing it here — rather
  // than a useState initializer — means it reflects the real value once the
  // user id resolves (auth loads async, so the key is null on first mount),
  // with no reappear-after-dismiss and no one-frame flash.
  const persistedDismissed =
    !!storageKey && typeof window !== "undefined" &&
    window.localStorage.getItem(storageKey) === "1";
  const [justDismissed, setJustDismissed] = useState(false);

  const items = useMemo(() => {
    const hasPhoto = !!profile?.avatar_url;
    const hasLocation = !!(profile?.town || profile?.state);
    const hasMatch = (profile?.total_matches ?? 0) > 0;
    return [
      { key: "photo", label: "Add a profile photo", desc: "So partners recognize you", to: "/player/profile/edit", icon: Camera, done: hasPhoto },
      { key: "location", label: "Set your location", desc: "Find play and players near you", to: "/player/profile/edit?focus=location", icon: MapPin, done: hasLocation },
      { key: "match", label: "Record your first match", desc: "Makes your PULSE rating real", to: "/player/matches/new", icon: Swords, done: hasMatch },
    ];
  }, [profile]);

  const doneCount = items.filter((i) => i.done).length;
  const allDone = doneCount === items.length;

  if (!userId || !profile || allDone || persistedDismissed || justDismissed) return null;

  const dismiss = () => {
    if (storageKey) window.localStorage.setItem(storageKey, "1");
    setJustDismissed(true);
  };

  return (
    <div className="relative mb-4 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-card to-card p-4 lg:mb-6">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss getting started"
        className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-3 flex items-center gap-2 pr-8">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Get started</p>
          <p className="text-xs text-muted-foreground">{doneCount} of {items.length} done</p>
        </div>
      </div>

      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.key}>
            {item.done ? (
              <div className="flex items-center gap-3 rounded-xl px-2.5 py-2 opacity-60">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium text-foreground line-through">{item.label}</span>
              </div>
            ) : (
              <Link
                to={item.to}
                className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-muted/60 active:scale-[0.99]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                  <item.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-foreground">{item.label}</span>
                  <span className="block text-xs text-muted-foreground">{item.desc}</span>
                </span>
                <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground/70")} />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
