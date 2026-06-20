/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  playerName?: string
  partnerName?: string
  eventName?: string
  divisionName?: string
  teamName?: string
  eventUrl?: string
}

const Email = ({
  playerName = 'Player',
  partnerName = 'your partner',
  eventName = 'the event',
  divisionName,
  teamName,
  eventUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview={`You've been paired with ${partnerName}`}
    eyebrow="Team Assignment"
  >
    <Text style={styles.h1}>Meet your partner.</Text>
    <Text style={styles.text}>
      {playerName}, you're paired with <strong>{partnerName}</strong> for{' '}
      <strong>{eventName}</strong>. Time to strategize.
    </Text>
    <DetailBlock
      rows={[
        { label: 'Partner', value: partnerName },
        ...(teamName ? [{ label: 'Team Name', value: teamName }] : []),
        ...(divisionName ? [{ label: 'Division', value: divisionName }] : []),
      ]}
    />
    <CTA href={eventUrl} label="View Team" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Paired with ${d.partnerName ?? 'your partner'}`,
  displayName: 'Team Assignment',
  previewData: {
    playerName: 'Alex',
    partnerName: 'Jordan Rivera',
    eventName: 'Summer Slam Doubles',
    divisionName: '4.0 Mixed Doubles',
    teamName: 'Alex & Jordan',
    eventUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
