import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Delete messages older than 48 hours
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - 48);

    const { data, error } = await supabase
      .from('channel_messages')
      .delete()
      .lt('created_at', cutoffTime.toISOString());

    if (error) {
      console.error('Error deleting old messages:', error);
      return new Response(
        JSON.stringify({ error: 'Failed to cleanup old messages' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cleaned up messages older than ${cutoffTime.toISOString()}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Old messages cleaned up successfully',
        cutoffTime: cutoffTime.toISOString()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
