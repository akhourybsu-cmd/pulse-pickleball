/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  playerName?: string
  eventName?: string
  startsIn?: string
  eventDate?: string
  eventLocation?: string
  eventUrl?: string
}

const Email = ({
  playerName = 'Player',
  eventName = 'your event',
  startsIn = 'soon',
  eventDate,
  eventLocation,
  eventUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview={`${eventName} starts ${startsIn}`}
    eyebrow="Reminder"
  >
    <Text style={styles.h1}>{eventName} starts {startsIn}.</Text>
    <Text style={styles.text}>
      Hi {playerName} — quick reminder so you don't miss it.
    </Text>
    <DetailBlock
      rows={[
        ...(eventDate ? [{ label: 'When', value: eventDate }] : []),
        ...(eventLocation ? [{ label: 'Location', value: eventLocation }] : []),
      ]}
    />
    <CTA href={eventUrl} label="View Event" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) =>
    `Reminder: ${d.eventName ?? 'your event'} starts ${d.startsIn ?? 'soon'}`,
  displayName: 'Event Reminder',
  previewData: {
    playerName: 'Alex',
    eventName: 'Friday Night Round Robin',
    startsIn: 'in 1 hour',
    eventDate: 'Fri, Jul 11 · 6:30 PM',
    eventLocation: 'Pickleball Palace · Tampa, FL',
    eventUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
