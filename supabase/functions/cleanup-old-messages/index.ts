import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-dispatch-secret',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const providedSecret = req.headers.get('x-dispatch-secret') ?? '';
    const { data: isAuthorized, error: authError } = await supabase.rpc(
      'is_valid_scheduled_task_secret',
      { p_secret: providedSecret },
    );
    if (authError || isAuthorized !== true) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Cleaned up messages older than ${cutoffTime.toISOString()}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Old messages cleaned up successfully',
        cutoffTime: cutoffTime.toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
