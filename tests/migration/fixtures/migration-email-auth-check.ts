// Manual destination-only fixture, deliberately outside supabase/functions.
// To use --verify-nested-email, temporarily deploy this as
// migration-email-auth-check with verify_jwt=false, then delete the deployment.
import { createClient } from 'npm:@supabase/supabase-js@2';
Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL')!;
  const userToken = req.headers.get('Authorization')?.replace(/^Bearer /i, '');
  if (!userToken) return new Response('Unauthorized', { status: 401 });
  const client = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
  const { error, data } = await client.auth.getUser(userToken);
  if (error || !data.user) return new Response('Unauthorized', { status: 401 });
  // No recipient or template: authorization is checked, but no email is sent.
  const response = await fetch(`${url}/functions/v1/send-transactional-email`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`, 'Content-Type': 'application/json' },
    body: '{}',
  });
  return Response.json({ nestedStatus: response.status });
});
