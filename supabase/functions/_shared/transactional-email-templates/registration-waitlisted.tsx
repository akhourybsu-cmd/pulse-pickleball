/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  playerName?: string
  eventName?: string
  position?: number | string
  eventUrl?: string
}

const Email = ({
  playerName = 'Player',
  eventName = 'the event',
  position,
  eventUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview={`You're on the waitlist for ${eventName}`}
    eyebrow="Waitlisted"
  >
    <Text style={styles.h1}>You're on the waitlist.</Text>
    <Text style={styles.text}>
      {playerName}, <strong>{eventName}</strong> is currently full. We'll
      automatically promote you the moment a spot opens up.
    </Text>
    {position !== undefined ? (
      <DetailBlock rows={[{ label: 'Waitlist Position', value: `#${position}` }]} />
    ) : null}
    <Text style={styles.text}>
      Keep an eye on your inbox — promotions happen on a first-come basis.
    </Text>
    <CTA href={eventUrl} label="View Event" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Waitlisted: ${d.eventName ?? 'your event'}`,
  displayName: 'Registration Waitlisted',
  previewData: {
    playerName: 'Alex',
    eventName: 'Summer Slam Doubles',
    position: 3,
    eventUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
