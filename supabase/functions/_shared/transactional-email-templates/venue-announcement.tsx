/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, Text, styles } from './_layout.tsx'

interface Props {
  recipientName?: string
  venueName?: string
  title?: string
  message?: string
  venueUrl?: string
}

const Email = ({
  recipientName = 'Player',
  venueName = 'your venue',
  title = 'Announcement',
  message = '',
  venueUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview={`${venueName}: ${title}`}
    eyebrow={venueName}
  >
    <Text style={styles.h1}>{title}</Text>
    <Text style={styles.text}>Hi {recipientName},</Text>
    <Text style={styles.text}>{message}</Text>
    <CTA href={venueUrl} label="Open Venue" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) =>
    `${d.venueName ?? 'Venue'}: ${d.title ?? 'Announcement'}`,
  displayName: 'Venue Announcement',
  previewData: {
    recipientName: 'Alex',
    venueName: 'Pickleball Palace',
    title: 'New open play hours this weekend',
    message:
      'We just added two more open play sessions Saturday morning. Drop in any time between 8 and 11 AM — paddles available at the front desk.',
    venueUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
