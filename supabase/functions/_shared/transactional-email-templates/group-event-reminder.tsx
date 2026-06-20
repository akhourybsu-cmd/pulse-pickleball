/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  playerName?: string
  groupName?: string
  eventName?: string
  startsIn?: string
  eventDate?: string
  eventLocation?: string
  eventUrl?: string
}

const Email = ({
  playerName = 'Player',
  groupName = 'your group',
  eventName = 'an event',
  startsIn = 'soon',
  eventDate,
  eventLocation,
  eventUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview={`${groupName}: ${eventName} starts ${startsIn}`}
    eyebrow={groupName}
  >
    <Text style={styles.h1}>{eventName} starts {startsIn}.</Text>
    <Text style={styles.text}>
      Hey {playerName} — heads up from <strong>{groupName}</strong>.
    </Text>
    <DetailBlock
      rows={[
        ...(eventDate ? [{ label: 'When', value: eventDate }] : []),
        ...(eventLocation ? [{ label: 'Location', value: eventLocation }] : []),
      ]}
    />
    <CTA href={eventUrl} label="Open Event" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) =>
    `${d.groupName ?? 'Group'}: ${d.eventName ?? 'event'} ${d.startsIn ?? 'soon'}`,
  displayName: 'Group Event Reminder',
  previewData: {
    playerName: 'Alex',
    groupName: 'Tampa Bay Pickleball',
    eventName: 'Open Play',
    startsIn: 'in 2 hours',
    eventDate: 'Sat, Jul 12 · 5:00 PM',
    eventLocation: 'Pickleball Palace',
    eventUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
