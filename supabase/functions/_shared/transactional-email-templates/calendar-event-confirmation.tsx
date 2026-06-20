/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  playerName?: string
  eventTitle?: string
  eventDate?: string
  eventLocation?: string
  notes?: string
  eventUrl?: string
}

const Email = ({
  playerName = 'Player',
  eventTitle = 'your booking',
  eventDate,
  eventLocation,
  notes,
  eventUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview={`Confirmed: ${eventTitle}`}
    eyebrow="Booking Confirmed"
  >
    <Text style={styles.h1}>You're booked, {playerName}.</Text>
    <Text style={styles.text}>
      <strong>{eventTitle}</strong> is on your calendar. Save the details below.
    </Text>
    <DetailBlock
      rows={[
        ...(eventDate ? [{ label: 'When', value: eventDate }] : []),
        ...(eventLocation ? [{ label: 'Location', value: eventLocation }] : []),
        ...(notes ? [{ label: 'Notes', value: notes }] : []),
      ]}
    />
    <CTA href={eventUrl} label="View Booking" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Confirmed: ${d.eventTitle ?? 'your booking'}`,
  displayName: 'Calendar Event Confirmation',
  previewData: {
    playerName: 'Alex',
    eventTitle: 'Court 3 · 90 min',
    eventDate: 'Sun, Jul 13 · 4:00 PM',
    eventLocation: 'Pickleball Palace · Tampa, FL',
    notes: 'Bring your own paddle. Doors open 15 min early.',
    eventUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
