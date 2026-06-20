/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  playerName?: string
  eventName?: string
  eventDate?: string
  eventLocation?: string
  divisionName?: string
  teamName?: string
  eventUrl?: string
}

const Email = ({
  playerName = 'Player',
  eventName = 'your event',
  eventDate,
  eventLocation,
  divisionName,
  teamName,
  eventUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview={`You're registered for ${eventName}`}
    eyebrow="Registration confirmed"
  >
    <Text style={styles.h1}>You're in, {playerName}.</Text>
    <Text style={styles.text}>
      Your registration for <strong>{eventName}</strong> has been received. Details
      below — we'll let you know once it's reviewed.
    </Text>
    <DetailBlock
      rows={[
        ...(eventDate ? [{ label: 'When', value: eventDate }] : []),
        ...(eventLocation ? [{ label: 'Location', value: eventLocation }] : []),
        ...(divisionName ? [{ label: 'Division', value: divisionName }] : []),
        ...(teamName ? [{ label: 'Team', value: teamName }] : []),
      ]}
    />
    <CTA href={eventUrl} label="View Event" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Registration received: ${d.eventName ?? 'your event'}`,
  displayName: 'Registration Confirmation',
  previewData: {
    playerName: 'Alex',
    eventName: 'Summer Slam Doubles',
    eventDate: 'Sat, Jul 12 · 9:00 AM',
    eventLocation: 'Pickleball Palace · Tampa, FL',
    divisionName: '4.0 Mixed Doubles',
    teamName: 'Alex & Jordan',
    eventUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
