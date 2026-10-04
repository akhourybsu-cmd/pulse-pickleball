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
    <Card className={cn("border-primary/20 bg-primary/[0.03]", className)}>
      <CardHeader className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Trophy className="h-4 w-4" /> Coming soon
        </div>
        <CardTitle className="text-base">
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
