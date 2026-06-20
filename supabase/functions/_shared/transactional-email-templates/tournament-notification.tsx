/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, Text, styles } from './_layout.tsx'

interface Props {
  playerName?: string
  tournamentName?: string
  title?: string
  message?: string
  tournamentUrl?: string
  ctaLabel?: string
}

const Email = ({
  playerName = 'Player',
  tournamentName = 'your tournament',
  title = 'Tournament update',
  message = '',
  tournamentUrl = 'https://pulsepb.com',
  ctaLabel = 'Open Tournament',
}: Props) => (
  <EmailLayout
    preview={`${tournamentName}: ${title}`}
    eyebrow={tournamentName}
  >
    <Text style={styles.h1}>{title}</Text>
    <Text style={styles.text}>Hi {playerName},</Text>
    <Text style={styles.text}>{message}</Text>
    <CTA href={tournamentUrl} label={ctaLabel} />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: (d: Props) =>
    `${d.tournamentName ?? 'Tournament'}: ${d.title ?? 'Update'}`,
  displayName: 'Tournament Notification',
  previewData: {
    playerName: 'Alex',
    tournamentName: 'Summer Slam Doubles',
    title: 'Bracket released',
    message:
      'Your bracket is live. First match check-in opens 30 minutes before your scheduled start time.',
    tournamentUrl: 'https://pulsepb.com',
    ctaLabel: 'View Bracket',
  },
} satisfies TemplateEntry
