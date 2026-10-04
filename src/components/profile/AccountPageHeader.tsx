import { Link } from "react-router-dom";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import { PlayerPageHeader } from "@/components/layout/PlayerPageHeader";

export function AccountPageHeader({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
}) {
  return (
    <>
      <div className="mx-auto max-w-3xl px-4 pt-4">
        <Link
          to="/player/profile"
          className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Profile & account
        </Link>
      </div>
      <PlayerPageHeader
        icon={icon}
        title={title}
        subtitle={subtitle}
        background="gradient"
      />
    </>
  );
}
