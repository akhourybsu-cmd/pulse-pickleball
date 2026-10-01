import {
  CalendarDays,
  MessageCircle,
  Newspaper,
  Users,
  Compass,
  ArrowUpRight,
} from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { CommunityTab } from "@/lib/community/navigation";

export function ClubhouseNavigation({
  chatEnabled,
  description,
  subtitle,
  onlineCount,
  connected,
  onTabChange,
}: {
  chatEnabled: boolean;
  description: string | null;
  subtitle: string;
  onlineCount: number;
  connected: boolean;
  onTabChange: (tab: CommunityTab) => void;
}) {
  const tabs = [
    {
      value: "feed",
      label: "Updates",
      icon: Newspaper,
      detail: "The latest from your people",
    },
    {
      value: "schedule",
      label: "Events",
      icon: CalendarDays,
      detail: "Make time for a game",
    },
    ...(chatEnabled
      ? [
          {
            value: "chat",
            label: "Chat",
            icon: MessageCircle,
            detail: "Keep the conversation going",
          },
        ]
      : []),
    {
      value: "members",
      label: "Members",
      icon: Users,
      detail: "Meet your community",
    },
    {
      value: "more",
      label: "About",
      icon: Compass,
      detail: "Details & shared resources",
    },
  ];
  return (
    <aside className="club-sidebar">
      <p className="club-sidebar-label">Your community</p>
      <TabsList className="club-navigation" aria-label="Community sections">
        {tabs.map(({ value, label, icon: Icon, detail }) => (
          <TabsTrigger key={value} value={value} className="club-nav-item">
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
            <span>
              <span className="block">{label}</span>
              <small>{detail}</small>
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      <div className="club-sidebar-about">
        <span className="club-eyebrow">On & off the court</span>
        <p className="mt-3 text-sm font-medium">{subtitle}</p>
        {description && (
          <p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground [overflow-wrap:anywhere]">
            {description}
          </p>
        )}
        <p className="club-presence">
          <span data-connected={connected} />
          {connected ? `${onlineCount} online now` : "Connecting to community…"}
        </p>
        <Button
          variant="ghost"
          onClick={() => onTabChange("more")}
          className="mt-2 h-10 w-full justify-between px-0 text-xs"
        >
          Community details
          <ArrowUpRight className="h-4 w-4" />
        </Button>
      </div>
    </aside>
  );
}
