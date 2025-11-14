import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourtFeed } from "@/components/court/feed/CourtFeed";
import { CourtHeatmap } from "@/components/court/CourtHeatmap";
import { CourtAnalytics } from "@/components/court/CourtAnalytics";
import { CourtMatchAnalytics } from "@/components/court/CourtMatchAnalytics";
import { CourtMatchTrends } from "@/components/court/CourtMatchTrends";
import { CourtTopPlayers } from "@/components/court/CourtTopPlayers";
import { MatchTypeBreakdown } from "@/components/court/MatchTypeBreakdown";
import { MessageSquare, Activity } from "lucide-react";

interface FeedPanelProps {
  courtId: string;
  courtName: string;
  currentUserId: string | null;
}

export function FeedPanel({ courtId, courtName, currentUserId }: FeedPanelProps) {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl sm:text-2xl">Court Feed • {courtName}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs defaultValue="feed" className="w-full">
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="feed" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              Court Feed
            </TabsTrigger>
            <TabsTrigger value="insights" className="gap-2">
              <Activity className="w-4 h-4" />
              Insights
            </TabsTrigger>
          </TabsList>

          <TabsContent value="feed" className="mt-0 space-y-4">
            <CourtFeed courtId={courtId} currentUserId={currentUserId} />
          </TabsContent>

          <TabsContent value="insights" className="mt-0 space-y-6">
            <CourtAnalytics courtId={courtId} />
            <CourtMatchAnalytics courtId={courtId} />
            <CourtHeatmap courtId={courtId} />
            <CourtMatchTrends courtId={courtId} />
            <MatchTypeBreakdown courtId={courtId} />
            <CourtTopPlayers courtId={courtId} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
