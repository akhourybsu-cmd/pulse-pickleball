import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { JoinableCalendarEvents } from "@/components/citi-events/JoinableCalendarEvents";
import { Calendar, Users, Play, HelpCircle } from "lucide-react";

interface PlayPanelProps {
  courtId: string;
  courtName: string;
  currentUserId: string | null;
  isAdmin: boolean;
  activeSessionId: string | null;
  onActivateSession: () => void;
  onViewSession: () => void;
  onSessionQueueHelp: () => void;
}

export function PlayPanel({ 
  courtId, 
  courtName,
  currentUserId,
  isAdmin,
  activeSessionId,
  onActivateSession,
  onViewSession,
  onSessionQueueHelp
}: PlayPanelProps) {
  const [activeTab, setActiveTab] = useState("events");

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-xl sm:text-2xl">Play at {courtName}</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          See upcoming events or manage the Session Queue for open play.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2 mb-4">
            <TabsTrigger value="events" className="gap-2">
              <Calendar className="w-4 h-4" />
              Events
            </TabsTrigger>
            <TabsTrigger value="queue" className="gap-2">
              <Users className="w-4 h-4" />
              Session Queue
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="mt-0">
            <div className="space-y-4">
              <JoinableCalendarEvents courtId={courtId} vertical />
            </div>
          </TabsContent>

          <TabsContent value="queue" className="mt-0">
            <div className="space-y-4">
              {/* Title row with status */}
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Session Queue</h3>
                <Badge 
                  variant={activeSessionId ? "default" : "secondary"}
                  className={activeSessionId ? "bg-primary/10 text-primary border border-primary/20" : ""}
                >
                  {activeSessionId ? "Active" : "Inactive"}
                </Badge>
              </div>

              {/* Description */}
              <p className="text-sm text-muted-foreground">
                We'll auto-build doubles courts from everyone in the queue. Great for open play or drop-in sessions.
              </p>

              {/* Inactive state */}
              {!activeSessionId && (
                <div className="space-y-4 pt-4">
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3 border border-border">
                    <p className="text-sm text-muted-foreground">
                      Once active, players can add themselves and see when they're up next.
                    </p>
                    <Button 
                      onClick={onActivateSession}
                      className="w-full gap-2"
                      style={{
                        backgroundColor: '#A9DC3D',
                        color: '#0E4C58',
                      }}
                    >
                      <Play className="w-4 h-4" />
                      Activate Session Queue
                    </Button>
                  </div>
                  
                  <Button
                    onClick={onSessionQueueHelp}
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2 text-muted-foreground"
                  >
                    <HelpCircle className="w-4 h-4" />
                    What is Session Queue?
                  </Button>
                </div>
              )}

              {/* Active state */}
              {activeSessionId && (
                <div className="space-y-4">
                  <div className="bg-primary/5 rounded-lg p-4 border border-primary/20">
                    <p className="text-sm font-medium text-primary mb-2">
                      Session is active
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Players can now join the queue and see their court assignments.
                    </p>
                  </div>
                  <Button 
                    onClick={onViewSession}
                    variant="outline"
                    className="w-full gap-2"
                  >
                    <Users className="w-4 h-4" />
                    View Active Session
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
