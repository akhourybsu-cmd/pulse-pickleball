import { useCallback, useEffect, useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { communityTab } from "@/lib/community/navigation";

/** The URL owns selection; visited panels retain their drafts and scroll state. */
export function useCommunityTabs(chatEnabled: boolean) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = communityTab(searchParams.get("tab"), chatEnabled);
  const [visitedTabs, setVisitedTabs] = useState<Set<string>>(
    () => new Set([activeTab])
  );
  useEffect(() => {
    setVisitedTabs((prev) =>
      prev.has(activeTab) ? prev : new Set([...prev, activeTab])
    );
  }, [activeTab]);
  const handleTabChange = useCallback(
    (tab: string) => {
      const normalized = communityTab(tab, chatEnabled);
      if (normalized === activeTab) return;
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", normalized);
        return next;
      }, { state: location.state });
      setVisitedTabs((prev) =>
        prev.has(normalized) ? prev : new Set([...prev, normalized])
      );
    },
    [activeTab, chatEnabled, setSearchParams, location.state]
  );
  return { activeTab, visitedTabs, handleTabChange };
}
