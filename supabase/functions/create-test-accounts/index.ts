import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Check if user is admin
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: roleData } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const createdAccounts = []
    const errors = []

    for (let i = 1; i <= 8; i++) {
      const email = `testaccount${i}@pulsetest.local`
      const password = 'TestPassword123!'
      const displayName = `Test Account${i}`

      try {
        // Create user in auth.users
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            full_name: displayName,
            display_name: displayName
          }
        })

        if (authError) {
          if (authError.message.includes('already registered')) {
            console.log(`Account ${email} already exists, updating profile...`)
            // Get existing user
            const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
            const existingUser = users.find(u => u.email === email)
            
            if (existingUser) {
              // Update profile
              await supabaseAdmin
                .from('profiles')
                .update({
                  full_name: displayName,
                  display_name: displayName,
                  current_rating: 3.5
                })
                .eq('id', existingUser.id)
              
              createdAccounts.push({ email, status: 'updated' })
            }
          } else {
            throw authError
          }
        } else if (authData.user) {
          // Update profile with additional data
          await supabaseAdmin
            .from('profiles')
            .update({
              full_name: displayName,
              display_name: displayName,
              current_rating: 3.5
            })
            .eq('id', authData.user.id)

          createdAccounts.push({ email, status: 'created' })
        }
      } catch (error: any) {
        errors.push({ email, error: error.message })
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        created: createdAccounts,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
