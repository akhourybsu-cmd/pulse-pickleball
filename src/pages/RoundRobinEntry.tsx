import { lazy, Suspense, useEffect } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { RoundRobinRegistration } from "@/components/round-robin/RoundRobinRegistration";
import { useRoundRobinEntry } from "@/hooks/useRoundRobinEntry";
import { clearPostAuthRedirect } from "@/lib/authRedirect";

const RoundRobinDetail = lazy(() => import("./RoundRobinDetail"));

export default function RoundRobinEntry() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const invite = params.get("invite");
  const entry = useRoundRobinEntry(id, invite);
  useEffect(() => {
    if (entry.auth.isAuthenticated && !entry.isPending) clearPostAuthRedirect(`${location.pathname}${location.search}${location.hash}`);
  }, [entry.auth.isAuthenticated, entry.isPending, location.pathname, location.search, location.hash]);
  if (entry.auth.isAuthenticated && entry.data?.can_open) return <Suspense fallback={<div role="status" className="p-12 text-center">Opening event…</div>}><RoundRobinDetail /></Suspense>;
  return <div className="min-h-screen bg-background">
    <header className="mx-auto flex max-w-4xl items-center justify-between px-5 py-5"><Link to="/" aria-label="PULSE home"><Logo className="h-10 w-auto" /></Link><ThemeToggle /></header>
    <main className="mx-auto max-w-2xl px-4 pb-12 pt-3"><RoundRobinRegistration key={`${id}:${invite ?? ""}`} entry={entry} eventId={id} inviteCode={invite} /></main>
  </div>;
}
