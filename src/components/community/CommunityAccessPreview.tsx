import type { ReactNode } from "react";
import { LockKeyhole } from "lucide-react";

/** Decorative shapes only: restricted messages and identities never reach this preview. */
export function CommunityAccessPreview({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section
      className="relative isolate grid overflow-hidden rounded-3xl border bg-card"
      aria-label={title}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none col-start-1 row-start-1 select-none space-y-6 p-6 opacity-40 blur-[6px] sm:p-8"
      >
        {[0, 1, 2, 3].map((row) => (
          <div
            key={row}
            className={`flex items-start gap-3 ${row % 2 ? "flex-row-reverse" : ""}`}
          >
            <div className="h-9 w-9 shrink-0 rounded-full bg-primary/25" />
            <div className="w-2/3 space-y-2 rounded-2xl bg-muted p-4">
              <div className="h-2 w-1/3 rounded bg-foreground/20" />
              <div className="h-2 w-full rounded bg-foreground/15" />
              <div className="h-2 w-3/4 rounded bg-foreground/15" />
            </div>
          </div>
        ))}
      </div>
      <div
        className="absolute inset-0 bg-gradient-to-b from-background/45 via-background/85 to-background/95"
        aria-hidden="true"
      />
      <div className="relative col-start-1 row-start-1 flex min-h-80 flex-col items-center justify-center gap-4 px-5 py-8 text-center sm:px-10">
        <span className="rounded-2xl border bg-background p-3">
          <LockKeyhole className="h-6 w-6 text-primary" aria-hidden="true" />
        </span>
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          {description}
        </p>
        <div className="w-full max-w-lg text-left">{children}</div>
      </div>
    </section>
  );
}
