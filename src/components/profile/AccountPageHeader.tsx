import { Link } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";

export function AccountPageHeader({
  title,
  subtitle,
  icon: Icon,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
}) {
  return (
    <header className="account-settings-header">
      <div className="mx-auto max-w-3xl px-4 pb-6 pt-5 sm:px-6 sm:pb-8">
        <Link
          to="/player/profile"
          className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border/60 bg-card/80 px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Profile & account
        </Link>
        <div className="mt-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="mb-2 flex flex-wrap items-center gap-x-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span className="font-extrabold tracking-[0.22em] text-foreground">
                PULSE
              </span>
              <span aria-hidden className="h-1 w-1 rounded-full bg-primary" />
              Account settings
            </p>
            <h1 className="break-words text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              {title}
            </h1>
            <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          </div>
          <div className="mt-1 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-foreground sm:h-14 sm:w-14">
            <Icon
              className="h-5 w-5 sm:h-6 sm:w-6"
              strokeWidth={1.75}
              aria-hidden
            />
          </div>
        </div>
      </div>
    </header>
  );
}
