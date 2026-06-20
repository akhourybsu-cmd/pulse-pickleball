/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  playerName?: string
  tournamentName?: string
  startsIn?: string
  eventDate?: string
  eventLocation?: string
  checkInWindow?: string
  tournamentUrl?: string
}

const Email = ({
  playerName = 'Player',
  tournamentName = 'your tournament',
  startsIn = 'soon',
  eventDate,
  eventLocation,
  checkInWindow,
  tournamentUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview={`${tournamentName} starts ${startsIn}`}
    eyebrow="Reminder"
  >
    <Text style={styles.h1}>{tournamentName} starts {startsIn}.</Text>
    <Text style={styles.text}>
      {playerName}, here's everything you need for game day.
    </Text>
    <DetailBlock
      rows={[
        ...(eventDate ? [{ label: 'When', value: eventDate }] : []),
        ...(eventLocation ? [{ label: 'Location', value: eventLocation }] : []),
        ...(checkInWindow
          ? [{ label: 'Check-in Window', value: checkInWindow }]
          : []),
      ]}
    />
    <CTA href={tournamentUrl} label="Open Tournament" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) =>
    `${d.tournamentName ?? 'Your tournament'} starts ${d.startsIn ?? 'soon'}`,
  displayName: 'Tournament Reminder',
  previewData: {
    playerName: 'Alex',
    tournamentName: 'Summer Slam Doubles',
    startsIn: 'tomorrow',
    eventDate: 'Sat, Jul 12 · 9:00 AM',
    eventLocation: 'Pickleball Palace · Tampa, FL',
    checkInWindow: '30 min before your first match',
    tournamentUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
