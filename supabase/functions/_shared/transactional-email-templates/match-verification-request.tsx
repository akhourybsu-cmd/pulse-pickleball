/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  recipientName?: string
  submittedByName?: string
  matchSummary?: string
  score?: string
  opponents?: string
  partner?: string
  playedAt?: string
  location?: string
  verifyUrl?: string
}

const Email = ({
  recipientName = 'there',
  submittedByName = 'A player',
  matchSummary,
  score,
  opponents,
  partner,
  playedAt,
  location,
  verifyUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview="A match has been entered and needs your verification"
    eyebrow="Verification needed"
  >
    <Text style={styles.h1}>Verify your match.</Text>
    <Text style={styles.text}>
      {recipientName}, <strong>{submittedByName}</strong> entered a match result
      that involves you. Please review and confirm the details below.
    </Text>
    <DetailBlock
      rows={[
        ...(matchSummary ? [{ label: 'Match', value: matchSummary }] : []),
        ...(score ? [{ label: 'Score', value: score }] : []),
        ...(partner ? [{ label: 'Partner', value: partner }] : []),
        ...(opponents ? [{ label: 'Opponents', value: opponents }] : []),
        ...(playedAt ? [{ label: 'Played', value: playedAt }] : []),
        ...(location ? [{ label: 'Location', value: location }] : []),
        { label: 'Submitted By', value: submittedByName },
      ]}
    />
    <CTA href={verifyUrl} label="Review & Verify" />
    <Text style={styles.muted}>
      If the score looks wrong, you can contest it from the same screen. Matches
      left unverified may auto-confirm after a waiting period.
    </Text>
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: ({ submittedByName }: Props = {}) =>
    `${submittedByName ?? 'A player'} entered a match — verify the result`,
  displayName: 'Match Verification Request',
  previewData: {
    recipientName: 'Jordan',
    submittedByName: 'Alex Chen',
    matchSummary: '4.0 Mixed Doubles · Court 3',
    score: '11–9, 8–11, 11–7',
    partner: 'Sam Rivera',
    opponents: 'Taylor Brooks & Morgan Lee',
    playedAt: 'Saturday, June 20 · 2:15 PM',
    location: 'Pickleball Palace',
    verifyUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
