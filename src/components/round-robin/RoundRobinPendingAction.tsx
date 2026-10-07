import { Loader2 } from "lucide-react";

export function RoundRobinPendingAction({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[70] flex justify-center px-4"
    >
      <div className="flex max-w-lg items-center gap-3 rounded-2xl border border-primary/40 bg-background px-5 py-3 text-foreground shadow-xl">
        <Loader2
          aria-hidden="true"
          className="h-5 w-5 shrink-0 animate-spin text-primary motion-reduce:animate-none"
        />
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Please wait. Controls unlock when this finishes.
          </p>
        </div>
      </div>
    </div>
  );
}
