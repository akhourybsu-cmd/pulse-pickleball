import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { format } from 'https://esm.sh/date-fns@3.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventReminder {
  user_id: string;
  event_id: string;
  event_type: 'calendar' | 'round_robin';
  event_name: string;
  event_time: string;
  location?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Checking for upcoming events requiring reminders...');

    // Calculate the time window: events starting in 55-65 minutes
    const now = new Date();
    const reminderWindowStart = new Date(now.getTime() + 55 * 60 * 1000);
    const reminderWindowEnd = new Date(now.getTime() + 65 * 60 * 1000);

    const reminders: EventReminder[] = [];

    // Fetch calendar events in the reminder window
    const { data: calendarEvents, error: calendarError } = await supabase
      .from('calendar_event_registrations')
      .select(`
        user_id,
        event_id,
        calendar_events (
          id,
          title,
          start_time,
          court_number,
          facility_id
        )
      `)
      .eq('status', 'confirmed')
      .gte('calendar_events.start_time', reminderWindowStart.toISOString())
      .lte('calendar_events.start_time', reminderWindowEnd.toISOString());

    if (calendarError) {
      console.error('Error fetching calendar events:', calendarError);
    } else if (calendarEvents) {
      for (const reg of calendarEvents) {
        const event = reg.calendar_events;
        if (!event) continue;

        reminders.push({
          user_id: reg.user_id,
          event_id: reg.event_id,
          event_type: 'calendar',
          event_name: event.title,
          event_time: event.start_time,
          location: `Court ${event.court_number}`
        });
      }
    }

    // Fetch round robin events in the reminder window
    const { data: roundRobinEvents, error: rrError } = await supabase
      .from('round_robin_players')
      .select(`
        player_id,
        event_id,
        event:round_robin_events (
          id,
          name,
          date,
          start_time,
          location
        )
      `)
      .eq('active', true)
      .eq('registration_status', 'confirmed');

    if (rrError) {
      console.error('Error fetching round robin events:', rrError);
    } else if (roundRobinEvents) {
      for (const reg of roundRobinEvents) {
        const event = reg.event;
        if (!event) continue;

        // Construct event datetime
        const eventDateTime = new Date(`${event.date}T${event.start_time || '09:00:00'}`);
        
        // Check if in reminder window
        if (eventDateTime >= reminderWindowStart && eventDateTime <= reminderWindowEnd) {
          reminders.push({
            user_id: reg.player_id,
            event_id: reg.event_id,
            event_type: 'round_robin',
            event_name: event.name,
            event_time: eventDateTime.toISOString(),
            location: event.location || undefined
          });
        }
      }
    }

    console.log(`Found ${reminders.length} events requiring reminders`);

    // Send notifications
    let sentCount = 0;
    let skippedCount = 0;

    for (const reminder of reminders) {
      // Check if reminder already sent
      const { data: existingReminder } = await supabase
        .from('event_reminders_sent')
        .select('id')
        .eq('user_id', reminder.user_id)
        .eq('event_id', reminder.event_id)
        .eq('event_type', reminder.event_type)
        .single();

      if (existingReminder) {
        skippedCount++;
        continue;
      }

      // Format the event time
      const eventTime = new Date(reminder.event_time);
      const timeStr = format(eventTime, 'h:mm a');
      const dateStr = format(eventTime, 'EEEE, MMM d');

      // Create notification
      const { error: notifError } = await supabase
        .from('user_notifications')
        .insert({
          user_id: reminder.user_id,
          notification_type: 'event_reminder',
          title: `Event Starting Soon!`,
          message: `${reminder.event_name} starts in 1 hour at ${timeStr}${reminder.location ? ` at ${reminder.location}` : ''}`,
          link: reminder.event_type === 'calendar' 
            ? '/events/my-calendar-registrations'
            : `/round-robin/${reminder.event_id}`,
          event_id: reminder.event_id,
          event_type: reminder.event_type,
          read: false
        });

      if (notifError) {
        console.error('Error creating notification:', notifError);
        continue;
      }

      // Mark reminder as sent
      await supabase
        .from('event_reminders_sent')
        .insert({
          user_id: reminder.user_id,
          event_id: reminder.event_id,
          event_type: reminder.event_type
        });

      sentCount++;
    }

    console.log(`Sent ${sentCount} reminders, skipped ${skippedCount} already sent`);

    return new Response(
      JSON.stringify({
        success: true,
        reminders_found: reminders.length,
        notifications_sent: sentCount,
        already_sent: skippedCount
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in send-event-reminders:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});