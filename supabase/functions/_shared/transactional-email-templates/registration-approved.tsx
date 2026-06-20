/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  playerName?: string
  eventName?: string
  divisionName?: string
  eventDate?: string
  eventLocation?: string
  eventUrl?: string
}

const Email = ({
  playerName = 'Player',
  eventName = 'your event',
  divisionName,
  eventDate,
  eventLocation,
  eventUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview={`Approved — you're confirmed for ${eventName}`}
    eyebrow="Approved"
  >
    <Text style={styles.h1}>You're confirmed.</Text>
    <Text style={styles.text}>
      {playerName}, your spot in <strong>{eventName}</strong> has been approved.
      See you on the court.
    </Text>
    <DetailBlock
      rows={[
        ...(divisionName ? [{ label: 'Division', value: divisionName }] : []),
        ...(eventDate ? [{ label: 'When', value: eventDate }] : []),
        ...(eventLocation ? [{ label: 'Location', value: eventLocation }] : []),
      ]}
    />
    <CTA href={eventUrl} label="Open Event" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Confirmed: ${d.eventName ?? 'your event'}`,
  displayName: 'Registration Approved',
  previewData: {
    playerName: 'Alex',
    eventName: 'Summer Slam Doubles',
    divisionName: '4.0 Mixed Doubles',
    eventDate: 'Sat, Jul 12 · 9:00 AM',
    eventLocation: 'Pickleball Palace · Tampa, FL',
    eventUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
