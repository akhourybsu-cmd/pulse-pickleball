/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  playerName?: string
  eventName?: string
  eventDate?: string
  eventLocation?: string
  format?: string
  eventUrl?: string
}

const Email = ({
  playerName = 'Player',
  eventName = 'the round robin',
  eventDate,
  eventLocation,
  format,
  eventUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview={`You're signed up for ${eventName}`}
    eyebrow="Round Robin"
  >
    <Text style={styles.h1}>Locked in, {playerName}.</Text>
    <Text style={styles.text}>
      Your spot in <strong>{eventName}</strong> is reserved. Pairings and the
      full schedule will be posted in your control center.
    </Text>
    <DetailBlock
      rows={[
        ...(eventDate ? [{ label: 'When', value: eventDate }] : []),
        ...(eventLocation ? [{ label: 'Location', value: eventLocation }] : []),
        ...(format ? [{ label: 'Format', value: format }] : []),
      ]}
    />
    <CTA href={eventUrl} label="Open Round Robin" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `You're in: ${d.eventName ?? 'Round Robin'}`,
  displayName: 'Round Robin Confirmation',
  previewData: {
    playerName: 'Alex',
    eventName: 'Friday Night Round Robin',
    eventDate: 'Fri, Jul 11 · 6:30 PM',
    eventLocation: 'Tampa, FL',
    format: 'Rotating Partners · 4 rounds',
    eventUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
