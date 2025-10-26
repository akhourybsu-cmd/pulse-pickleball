import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bell } from "lucide-react";

interface EditNotificationsProps {
  eventId: string;
  userId: string | null;
  isOrganizer: boolean;
}

export function EditNotifications({
  eventId,
  userId,
  isOrganizer,
}: EditNotificationsProps) {
  const { toast } = useToast();
  const [lastAuditId, setLastAuditId] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId || !userId || isOrganizer) return;

    // Fetch the most recent audit entry to establish a baseline
    const fetchLatestAudit = async () => {
      const { data } = await supabase
        .from("round_robin_audit")
        .select("id")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setLastAuditId(data.id);
      }
    };

    fetchLatestAudit();

    // Subscribe to new audit entries
    const channel = supabase
      .channel(`audit-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "round_robin_audit",
          filter: `event_id=eq.${eventId}`,
        },
        async (payload) => {
          const newEntry = payload.new as any;

          // Only show notification if this is a new entry (after our baseline)
          if (!lastAuditId || newEntry.created_at > lastAuditId) {
            // Don't notify if the change was made by the current user
            if (newEntry.editor_id !== userId) {
              // Fetch the user's name
              const { data: profileData } = await supabase
                .from("profiles")
                .select("display_name, email")
                .eq("id", newEntry.editor_id)
                .single();

              const editorName =
                profileData?.display_name ||
                profileData?.email ||
                "An organizer";

              const actionLabels: Record<string, string> = {
                event_settings: "updated event settings",
                player_add: "added a player",
                player_inactive: "marked a player inactive",
                player_substitute: "substituted a player",
                courts_update: "updated the number of courts",
                rounds_update: "updated the number of rounds",
                schedule_edit: "edited the schedule",
                score_edit: "edited a match score",
                match_void: "voided a match",
                match_delete: "deleted a match",
              };

              const actionLabel =
                actionLabels[newEntry.change_type] || "made a change";

              toast({
                title: "Event Updated",
                description: `${editorName} ${actionLabel}`,
                duration: 5000,
              });
            }

            setLastAuditId(newEntry.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, userId, isOrganizer, lastAuditId, toast]);

  return null; // This component only handles notifications
}
