import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0'
import { sendViaResend } from '../_shared/resend.ts'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, content-type, webhook-id, webhook-signature, webhook-timestamp',
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirm your PULSE email',
  invite: "You've been invited to PULSE",
  magiclink: 'Your PULSE login link',
  recovery: 'Reset your PULSE password',
  email_change: 'Confirm your new PULSE email',
  reauthentication: 'Your PULSE verification code',
}

interface EmailTemplateProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token: string
  email: string
  oldEmail: string
  newEmail: string
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<EmailTemplateProps>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

const SITE_NAME = 'PULSE Pickleball'
const ROOT_DOMAIN = 'pulsepb.com'
const FROM = 'PULSE <support@pulsepb.com>'

interface AuthHookUser {
  email?: string
  new_email?: string
}

interface AuthHookEmailData {
  token: string
  token_hash: string
  redirect_to: string
  email_action_type: string
  site_url: string
  token_new?: string
  token_hash_new?: string
  old_email?: string
}

interface AuthEmailHookPayload {
  user: AuthHookUser
  email_data: AuthHookEmailData
}

interface Delivery {
  to: string
  token: string
  tokenHash: string
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function buildActionUrl(emailData: AuthHookEmailData, tokenHash: string): string {
  if (!tokenHash) return emailData.redirect_to || `https://${ROOT_DOMAIN}/`

  const actionUrl = new URL('/auth/v1/verify', emailData.site_url)
  actionUrl.searchParams.set('token', tokenHash)
  actionUrl.searchParams.set('type', emailData.email_action_type)
  if (emailData.redirect_to) {
    actionUrl.searchParams.set('redirect_to', emailData.redirect_to)
  }
  return actionUrl.toString()
}

function getDeliveries(payload: AuthEmailHookPayload): Delivery[] {
  const { user, email_data: emailData } = payload
  const currentEmail = emailData.old_email || user.email || ''
  const newEmail = user.new_email || ''

  if (emailData.email_action_type !== 'email_change') {
    return user.email
      ? [{ to: user.email, token: emailData.token, tokenHash: emailData.token_hash }]
      : []
  }

  // With Secure Email Change enabled, Supabase requires one message for the
  // current address and one for the new address. The hash names are reversed
  // for backward compatibility; this mapping follows Supabase's hook contract.
  if (
    currentEmail &&
    newEmail &&
    emailData.token_hash_new &&
    emailData.token_hash
  ) {
    return [
      {
        to: currentEmail,
        token: emailData.token,
        tokenHash: emailData.token_hash_new,
      },
      {
        to: newEmail,
        token: emailData.token_new || emailData.token,
        tokenHash: emailData.token_hash,
      },
    ]
  }

  const recipient = newEmail || currentEmail
  if (!recipient) return []
  return [{
    to: recipient,
    token: emailData.token_new || emailData.token,
    tokenHash: emailData.token_hash || emailData.token_hash_new || '',
  }]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!hookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Auth email hook is missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  let payload: AuthEmailHookPayload
  try {
    const rawBody = await req.text()
    const webhook = new Webhook(hookSecret.replace('v1,whsec_', ''))
    payload = webhook.verify(
      rawBody,
      Object.fromEntries(req.headers),
    ) as AuthEmailHookPayload
  } catch (error) {
    console.error('Auth email hook signature verification failed', { error })
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  const emailType = payload.email_data?.email_action_type
  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  const deliveries = getDeliveries(payload)
  if (!EmailTemplate || deliveries.length === 0) {
    console.error('Unsupported or incomplete auth email payload', { emailType })
    return jsonResponse({ error: 'Invalid webhook payload' }, 400)
  }

  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
  const currentEmail = payload.email_data.old_email || payload.user.email || ''
  const newEmail = payload.user.new_email || ''

  try {
    for (const delivery of deliveries) {
      const confirmationUrl = buildActionUrl(payload.email_data, delivery.tokenHash)
      const templateProps = {
        siteName: SITE_NAME,
        siteUrl: `https://${ROOT_DOMAIN}`,
        recipient: delivery.to,
        confirmationUrl,
        token: delivery.token,
        email: delivery.to,
        oldEmail: currentEmail,
        newEmail: newEmail || delivery.to,
      }
      const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
      const text = await renderAsync(React.createElement(EmailTemplate, templateProps), {
        plainText: true,
      })
      const attemptId = crypto.randomUUID()

      try {
        const result = await sendViaResend({
          to: delivery.to,
          from: FROM,
          subject: EMAIL_SUBJECTS[emailType] || 'PULSE notification',
          html,
          text,
        })
        const { error: logError } = await admin.from('email_send_log').insert({
          message_id: result.id || attemptId,
          template_name: emailType,
          recipient_email: delivery.to,
          status: 'sent',
        })
        if (logError) console.warn('Failed to log sent auth email', { logError })
      } catch (sendError) {
        await admin.from('email_send_log').insert({
          message_id: attemptId,
          template_name: emailType,
          recipient_email: delivery.to,
          status: 'failed',
          error_message: String(sendError).slice(0, 500),
        })
        throw sendError
      }
    }
  } catch (error) {
    console.error('Auth email delivery failed', { emailType, error })
    return jsonResponse({ error: 'Email delivery failed' }, 500)
  }

  // Supabase treats an empty JSON response with HTTP 200 as hook success.
  return jsonResponse({})
})
