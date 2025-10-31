import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

Deno.serve(async (req) => {
  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Delete messages older than 48 hours
    const fortyEightHoursAgo = new Date()
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48)

    const { data, error } = await supabaseClient
      .from('channel_messages')
      .delete()
      .lt('created_at', fortyEightHoursAgo.toISOString())

    if (error) {
      console.error('Error deleting old messages:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log('Successfully deleted old court chat messages')
    return new Response(
      JSON.stringify({ success: true, message: 'Old messages deleted' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Cleanup error:', err)
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
