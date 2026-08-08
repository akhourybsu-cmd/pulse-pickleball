// App-controlled auth emails.
//
// Replaces GoTrue's built-in mailer (which is owned by the platform hook and
// sends from the default sender) for every auth flow we drive ourselves:
//   - recovery      : password reset
//   - signup        : email confirmation / finish sign-in for a new account
//   - magiclink     : passwordless login link
//   - email_change  : confirm a new address
//   - invite        : invite an address to the app
//
// The link is minted with the service role via GoTrue's admin generateLink API,
// rendered with the branded PULSE React Email templates, and delivered straight
// through Resend on the verified pulsepb.com domain.
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { sendViaResend } from '../_shared/resend.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_NAME = 'PULSE Pickleball'
const ROOT_DOMAIN = 'pulsepb.com'
const FROM = 'PULSE <support@pulsepb.com>'

type AuthEmailType = 'recovery' | 'signup' | 'magiclink' | 'email_change' | 'invite'

const SUBJECTS: Record<AuthEmailType, string> = {
  signup: 'Confirm your PULSE email',
  invite: "You've been invited to PULSE",
  magiclink: 'Your PULSE login link',
  recovery: 'Reset your PULSE password',
  email_change: 'Confirm your new PULSE email',
}

const TEMPLATES: Record<AuthEmailType, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
}

const ALLOWED: AuthEmailType[] = ['recovery', 'signup', 'magiclink', 'email_change', 'invite']

const ok = (body: Record<string, unknown> = { success: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const bad = (message: string, status = 400) =>
  new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  let body: any
  try {
    body = await req.json()
  } catch {
    return bad('Invalid JSON body')
  }

  const type = String(body?.type ?? '') as AuthEmailType
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const newEmail =
    typeof body?.newEmail === 'string' ? body.newEmail.trim().toLowerCase() : undefined
  const redirectTo =
    typeof body?.redirectTo === 'string' && body.redirectTo.startsWith('http')
      ? body.redirectTo
      : `https://${ROOT_DOMAIN}/`

  if (!ALLOWED.includes(type)) return bad('Unsupported email type')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad('Valid email required')
  if (type === 'email_change' && !newEmail) return bad('newEmail required for email_change')

  // email_change and invite are privileged: require the caller's own session.
  if (type === 'email_change' || type === 'invite') {
    const jwt = req.headers.get('Authorization')?.replace('Bearer ', '') ?? ''
    const { data: caller } = await admin.auth.getUser(jwt)
    if (!caller?.user) return bad('Unauthorized', 401)
    if (type === 'email_change' && caller.user.email?.toLowerCase() !== email) {
      return bad('Unauthorized', 401)
    }
  }

  try {
    // GoTrue mints the real action link; `signup` for an existing unconfirmed
    // user is delivered as a magic link (verifying it confirms the address).
    const linkType = type === 'signup' ? 'magiclink' : type
    const { data: link, error: linkError } = await admin.auth.admin.generateLink({
      type: linkType as any,
      email,
      ...(type === 'email_change' ? { newEmail } : {}),
      options: { redirectTo },
    } as any)

    if (linkError || !link?.properties?.action_link) {
      // Never disclose whether an address exists.
      console.error('generateLink failed', { type, error: linkError?.message })
      return ok({ success: true, sent: false })
    }

    const props = {
      siteName: SITE_NAME,
      siteUrl: `https://${ROOT_DOMAIN}`,
      recipient: type === 'email_change' ? newEmail : email,
      confirmationUrl: link.properties.action_link,
      email,
      oldEmail: email,
      newEmail,
    }

    const Template = TEMPLATES[type]
    const html = await renderAsync(React.createElement(Template, props))
    const text = await renderAsync(React.createElement(Template, props), { plainText: true })

    const recipient = (type === 'email_change' ? newEmail : email)!
    const messageId = crypto.randomUUID()

    try {
      await sendViaResend({
        to: recipient,
        from: FROM,
        subject: SUBJECTS[type],
        html,
        text,
      })
      await admin.from('email_send_log').insert({
        message_id: messageId,
        template_name: type,
        recipient_email: recipient,
        status: 'sent',
      })
    } catch (sendError: any) {
      await admin.from('email_send_log').insert({
        message_id: messageId,
        template_name: type,
        recipient_email: recipient,
        status: 'failed',
        error_message: String(sendError?.message ?? sendError).slice(0, 500),
      })
      throw sendError
    }

    return ok({ success: true, sent: true })
  } catch (error: any) {
    console.error('auth-email failed', { type, error: error?.message })
    return bad('Failed to send email', 500)
  }
})
