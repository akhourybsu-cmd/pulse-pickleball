import { createClient } from 'npm:@supabase/supabase-js@2'
import { Resend } from 'npm:resend'

type SuppressionReason = 'bounce' | 'complaint' | 'suppression'

interface ResendWebhookEvent {
  type: string
  created_at?: string
  data?: {
    email?: string
    email_id?: string
    to?: string | string[]
    [key: string]: unknown
  }
}

function jsonResponse(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function getReason(eventType: string): SuppressionReason | null {
  switch (eventType) {
    case 'email.bounced':
      return 'bounce'
    case 'email.complained':
      return 'complaint'
    case 'email.suppressed':
    case 'suppression.added':
      return 'suppression'
    default:
      return null
  }
}

function getRecipients(event: ResendWebhookEvent): string[] {
  const recipients = new Set<string>()
  const to = event.data?.to
  if (typeof to === 'string') recipients.add(to)
  if (Array.isArray(to)) {
    for (const email of to) {
      if (typeof email === 'string') recipients.add(email)
    }
  }
  if (typeof event.data?.email === 'string') recipients.add(event.data.email)

  return [...recipients]
    .map((email) => email.trim().toLowerCase())
    .filter((email) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  const webhookSecret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!resendApiKey || !webhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Email suppression handler is missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  let event: ResendWebhookEvent
  try {
    const rawBody = await req.text()
    const resend = new Resend(resendApiKey)
    event = resend.webhooks.verify({
      payload: rawBody,
      headers: {
        id: req.headers.get('svix-id') ?? '',
        timestamp: req.headers.get('svix-timestamp') ?? '',
        signature: req.headers.get('svix-signature') ?? '',
      },
      webhookSecret,
    }) as unknown as ResendWebhookEvent
  } catch (error) {
    console.error('Invalid Resend webhook signature', { error })
    return jsonResponse({ error: 'Invalid signature' }, 401)
  }

  const reason = getReason(event.type)
  if (!reason) {
    return jsonResponse({ success: true, ignored: true })
  }

  const recipients = getRecipients(event)
  if (recipients.length === 0) {
    console.error('Resend suppression event did not include a recipient', {
      eventType: event.type,
    })
    return jsonResponse({ error: 'Invalid payload' }, 400)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
  const messageId = typeof event.data?.email_id === 'string'
    ? event.data.email_id
    : null
  const metadata = {
    provider: 'resend',
    event_type: event.type,
    event_created_at: event.created_at ?? null,
  }

  for (const email of recipients) {
    const { error: suppressError } = await supabase
      .from('suppressed_emails')
      .upsert(
        { email, reason, metadata },
        { onConflict: 'email' },
      )

    if (suppressError) {
      console.error('Failed to record suppressed email', { suppressError })
      return jsonResponse({ error: 'Failed to write suppression' }, 500)
    }

    const { error: insertError } = await supabase
      .from('email_send_log')
      .insert({
        message_id: messageId,
        template_name: 'system',
        recipient_email: email,
        status: mapReasonToStatus(reason),
        error_message: mapReasonToMessage(reason),
        metadata,
      })

    if (insertError) {
      // Non-fatal: the suppression itself was already recorded.
      console.warn('Failed to append suppression email log', { insertError })
    }
  }

  console.log('Resend suppression processed', {
    eventType: event.type,
    recipientCount: recipients.length,
    hasMessageId: Boolean(messageId),
  })
  return jsonResponse({ success: true })
})

function mapReasonToStatus(
  reason: SuppressionReason,
): 'bounced' | 'complained' | 'suppressed' {
  switch (reason) {
    case 'bounce':
      return 'bounced'
    case 'complaint':
      return 'complained'
    default:
      return 'suppressed'
  }
}

function mapReasonToMessage(reason: SuppressionReason): string {
  switch (reason) {
    case 'bounce':
      return 'Permanent bounce — email address is invalid or rejected'
    case 'complaint':
      return 'Spam complaint — recipient marked email as spam'
    default:
      return 'Message suppressed by Resend'
  }
}
