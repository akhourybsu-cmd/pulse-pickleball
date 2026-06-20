/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  playerName?: string
  courtNumber?: string
  matchTime?: string
  opponentTeam?: string
  divisionName?: string
  eventName?: string
  matchUrl?: string
}

const Email = ({
  playerName = 'Player',
  courtNumber = '—',
  matchTime,
  opponentTeam,
  divisionName,
  eventName,
  matchUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview={`Court ${courtNumber} — your match is ready`}
    eyebrow="Court Assignment"
  >
    <Text style={styles.h1}>Court {courtNumber}. You're up.</Text>
    <Text style={styles.text}>
      {playerName}, head to the court. Report within 10 minutes to avoid forfeit.
    </Text>
    <DetailBlock
      rows={[
        { label: 'Court', value: `Court ${courtNumber}` },
        ...(matchTime ? [{ label: 'Time', value: matchTime }] : []),
        ...(opponentTeam ? [{ label: 'Opponent', value: opponentTeam }] : []),
        ...(divisionName ? [{ label: 'Division', value: divisionName }] : []),
        ...(eventName ? [{ label: 'Event', value: eventName }] : []),
      ]}
    />
    <CTA href={matchUrl} label="Open Match" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) =>
    `Court ${d.courtNumber ?? ''} — ${d.eventName ?? 'your match'}`,
  displayName: 'Court Assignment',
  previewData: {
    playerName: 'Alex',
    courtNumber: '4',
    matchTime: '10:45 AM',
    opponentTeam: 'Smith / Patel',
    divisionName: '4.0 Mixed Doubles',
    eventName: 'Summer Slam Doubles',
    matchUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
