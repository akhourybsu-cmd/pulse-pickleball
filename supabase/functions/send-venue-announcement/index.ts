import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { announcement_id } = await req.json();

    if (!announcement_id) {
      return new Response(
        JSON.stringify({ success: false, error: "announcement_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-venue-announcement] Processing announcement ${announcement_id}`);

    // Get announcement details
    const { data: announcement, error: announcementError } = await supabase
      .from("venue_announcements")
      .select(`
        *,
        venues:venue_id (
          id,
          name,
          slug
        )
      `)
      .eq("id", announcement_id)
      .single();

    if (announcementError || !announcement) {
      console.error("[send-venue-announcement] Announcement not found:", announcementError);
      return new Response(
        JSON.stringify({ success: false, error: "Announcement not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine recipients based on target_audience
    let recipientIds: string[] = [];

    if (announcement.target_audience === "followers" || announcement.target_audience === "all") {
      // Get followers who opted into announcements
      const { data: followers } = await supabase
        .from("venue_followers")
        .select("user_id")
        .eq("venue_id", announcement.venue_id)
        .eq("notify_announcements", true);

      if (followers) {
        recipientIds = [...recipientIds, ...followers.map((f) => f.user_id)];
      }
    }

    if (announcement.target_audience === "past_attendees" || announcement.target_audience === "all") {
      // Get past event attendees for this venue
      const { data: attendees } = await supabase
        .from("event_registrations")
        .select(`
          user_id,
          unified_events!inner (
            host_venue_id
          )
        `)
        .eq("unified_events.host_venue_id", announcement.venue_id)
        .eq("status", "confirmed");

      if (attendees) {
        const attendeeIds = attendees.map((a) => a.user_id);
        recipientIds = [...recipientIds, ...attendeeIds];
      }
    }

    // Deduplicate recipients
    recipientIds = [...new Set(recipientIds)];

    console.log(`[send-venue-announcement] Sending to ${recipientIds.length} recipients`);

    // Create notifications for each recipient
    const notifications = recipientIds.map((userId) => ({
      user_id: userId,
      notification_type: "venue_announcement",
      category: "venues",
      title: announcement.title,
      message: announcement.message,
      link: `/venue/${announcement.venues?.slug || announcement.venue_id}`,
      priority: "normal",
      metadata: {
        venue_id: announcement.venue_id,
        venue_name: announcement.venues?.name,
        announcement_id: announcement.id,
      },
    }));

    if (notifications.length > 0) {
      // Batch insert notifications (in chunks of 100)
      const chunkSize = 100;
      for (let i = 0; i < notifications.length; i += chunkSize) {
        const chunk = notifications.slice(i, i + chunkSize);
        const { error: insertError } = await supabase
          .from("user_notifications")
          .insert(chunk);

        if (insertError) {
          console.error("[send-venue-announcement] Error inserting notifications:", insertError);
        }
      }
    }

    // Update announcement with recipient count and sent timestamp
    await supabase
      .from("venue_announcements")
      .update({
        sent_at: new Date().toISOString(),
        recipient_count: recipientIds.length,
      })
      .eq("id", announcement_id);

    console.log(`[send-venue-announcement] Successfully sent to ${recipientIds.length} recipients`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        recipient_count: recipientIds.length 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[send-venue-announcement] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
