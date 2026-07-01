import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin } from "@/lib/permissions";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import type { League } from "@/lib/leagues/types";
import { OverviewTab } from "@/components/admin/leagues/OverviewTab";
import { SeasonsTab } from "@/components/admin/leagues/SeasonsTab";
import { DivisionsTab } from "@/components/admin/leagues/DivisionsTab";
import { MembersTab } from "@/components/admin/leagues/MembersTab";
import { TeamsTab } from "@/components/admin/leagues/TeamsTab";
import { SessionsTab } from "@/components/admin/leagues/SessionsTab";
import { MatchesTab } from "@/components/admin/leagues/MatchesTab";
import { AuditLogTab } from "@/components/admin/leagues/AuditLogTab";
import { cn } from "@/lib/utils";

export default function AdminLeagueDetail() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [league, setLeague] = useState<League | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !(await isPlatformAdmin(user.id))) {
        toast.error("Admin privileges required");
        navigate("/player/dashboard");
        return;
      }
      if (!leagueId) {
        navigate("/admin/leagues");
        return;
      }
      await refresh();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueId]);

  const refresh = async () => {
    if (!leagueId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("leagues" as never)
      .select("*")
      .eq("id", leagueId)
      .maybeSingle();
    if (error || !data) {
      toast.error("League not found");
      navigate("/admin/leagues");
      return;
    }
    setLeague(data as unknown as League);
    setLoading(false);
  };

  if (loading || !league) {
    return (
      <AdminLayout title="League">
        <div className="container mx-auto px-4 py-10 text-center text-muted-foreground text-sm">
          Loading…
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={league.name}>
      <div className="container mx-auto px-4 py-5 max-w-5xl space-y-4">
        {/* Compact hero */}
        <div className="rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl font-bold truncate">{league.name}</h1>
              {league.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {league.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusPill status={league.status} />
                <Badge variant="outline" className="text-[10px]">
                  {league.league_type}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {league.visibility.replace("_", " ")}
                </Badge>
                {league.rating_eligible ? (
                  <Badge className="text-[10px]">Rating-eligible</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    Not rating-eligible
                  </Badge>
                )}
                {league.guests_allowed && (
                  <Badge variant="secondary" className="text-[10px]">
                    Guests allowed
                  </Badge>
                )}
              </div>
              {league.location && (
                <div className="text-xs text-muted-foreground mt-2">
                  {league.location}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full flex-wrap h-auto justify-start gap-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="seasons">Seasons</TabsTrigger>
            <TabsTrigger value="divisions">Divisions</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="matches">Matches</TabsTrigger>
            <TabsTrigger value="audit">Audit Log</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="pt-4">
            <OverviewTab league={league} onRefresh={refresh} />
          </TabsContent>
          <TabsContent value="seasons" className="pt-4">
            <SeasonsTab league={league} />
          </TabsContent>
          <TabsContent value="divisions" className="pt-4">
            <DivisionsTab league={league} />
          </TabsContent>
          <TabsContent value="members" className="pt-4">
            <MembersTab league={league} />
          </TabsContent>
          <TabsContent value="teams" className="pt-4">
            <TeamsTab league={league} />
          </TabsContent>
          <TabsContent value="sessions" className="pt-4">
            <SessionsTab league={league} />
          </TabsContent>
          <TabsContent value="matches" className="pt-4">
            <MatchesTab league={league} />
          </TabsContent>
          <TabsContent value="audit" className="pt-4">
            <AuditLogTab league={league} />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}

function StatusPill({ status }: { status: League["status"] }) {
  const tone =
    status === "active"
      ? "bg-primary/15 text-primary"
      : status === "archived"
      ? "bg-slate-500/15 text-slate-500"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
        tone,
      )}
    >
      {status}
    </span>
  );
}
