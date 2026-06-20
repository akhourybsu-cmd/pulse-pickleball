/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  inquirerName?: string
  inquirerEmail?: string
  venueName?: string
  city?: string
  message?: string
  adminUrl?: string
}

const Email = ({
  inquirerName = 'A prospect',
  inquirerEmail = '',
  venueName = '—',
  city,
  message,
  adminUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview={`New venue inquiry: ${venueName}`}
    eyebrow="New venue lead"
  >
    <Text style={styles.h1}>New venue inquiry.</Text>
    <Text style={styles.text}>
      <strong>{inquirerName}</strong> just submitted a venue interest form.
    </Text>
    <DetailBlock
      rows={[
        { label: 'Venue', value: venueName },
        ...(city ? [{ label: 'City', value: city }] : []),
        { label: 'Contact', value: `${inquirerName} · ${inquirerEmail}` },
        ...(message ? [{ label: 'Message', value: message }] : []),
      ]}
    />
    <CTA href={adminUrl} label="Open Admin Panel" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `New venue inquiry: ${d.venueName ?? 'unnamed'}`,
  displayName: 'Venue Inquiry Alert',
  previewData: {
    inquirerName: 'Jamie Lin',
    inquirerEmail: 'jamie@example.com',
    venueName: 'Riverside Courts',
    city: 'Austin, TX',
    message: 'Looking to bring our 6-court facility onto the platform.',
    adminUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
