import { type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

/**
 * Standalone shell for the public legal / account pages (Privacy, Terms,
 * Delete account). Mirrors the app's top bar (ink header + cream logo) so these
 * pages feel on-brand while living OUTSIDE the authenticated PlayerShell — they
 * must be reachable logged-out (app-store listing links + reviewers).
 */
export function LegalPageLayout({
  title,
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 border-b border-secondary-foreground/10 bg-secondary">
        <div className="w-full max-w-3xl mx-auto px-4 py-3 flex items-center gap-2 h-[60px]">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9 -ml-1 text-secondary-foreground hover:bg-secondary-foreground/10"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Link to="/" className="text-secondary-foreground hover:opacity-90 transition-opacity" aria-label="PULSE home">
            <Logo className="h-9 w-auto" />
          </Link>
        </div>
      </header>

      <main className="flex-1 w-full container mx-auto px-4 py-6 max-w-3xl">
        {title && (
          <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-foreground mb-5">
            {title}
          </h1>
        )}
        {children}
      </main>

      <footer className="border-t border-border/40 py-6">
        <div className="max-w-3xl mx-auto px-4 flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link to="/delete-account" className="hover:text-foreground transition-colors">Delete account</Link>
          </div>
          <p className="text-[11px] text-muted-foreground/70">
            © {new Date().getFullYear()} PULSE — Pickleball Universal Level & Skill Estimator
          </p>
        </div>
      </footer>
    </div>
  );
}
