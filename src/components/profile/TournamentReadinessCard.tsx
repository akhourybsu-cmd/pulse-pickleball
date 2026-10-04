import { Trophy } from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function TournamentReadinessCard({ className }: { className?: string }) {
  return (
    <Card
      className={cn(
        "rounded-2xl border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card shadow-none hover:shadow-none",
        className
      )}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Trophy className="h-4 w-4 text-primary" aria-hidden /> Coming soon
        </div>
        <CardTitle className="text-base leading-snug sm:text-lg md:text-lg">
          Tournaments are coming to PULSE
        </CardTitle>
        <CardDescription className="leading-relaxed">
          Get a head start by keeping your name, photo and player details up to
          date. Tournament registration is not available yet.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
