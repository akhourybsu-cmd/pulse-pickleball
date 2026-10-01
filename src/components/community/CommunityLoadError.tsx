import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CommunityLoadError({
  subject,
  onRetry,
}: {
  subject: string;
  onRetry: () => unknown;
}) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-border bg-card p-6 text-center"
    >
      <p className="font-semibold">We couldn’t load {subject}.</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Check your connection and try again.
      </p>
      <Button
        variant="outline"
        className="mt-4 gap-2"
        onClick={() => void onRetry()}
      >
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}
