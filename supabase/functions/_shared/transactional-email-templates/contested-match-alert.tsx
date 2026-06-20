/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'
import { EmailLayout, CTA, DetailBlock, Text, styles } from './_layout.tsx'

interface Props {
  recipientName?: string
  contesterName?: string
  matchSummary?: string
  reason?: string
  matchUrl?: string
}

const Email = ({
  recipientName = 'Admin',
  contesterName = 'A player',
  matchSummary = 'a recent match',
  reason,
  matchUrl = 'https://pulsepb.com',
}: Props) => (
  <EmailLayout
    preview="A match score has been contested"
    eyebrow="Action needed"
  >
    <Text style={styles.h1}>Match contested.</Text>
    <Text style={styles.text}>
      {recipientName}, <strong>{contesterName}</strong> contested{' '}
      <strong>{matchSummary}</strong>.
    </Text>
    <DetailBlock
      rows={[
        { label: 'Match', value: matchSummary },
        { label: 'Contested By', value: contesterName },
        ...(reason ? [{ label: 'Reason', value: reason }] : []),
      ]}
    />
    <CTA href={matchUrl} label="Review Match" />
  </EmailLayout>
)

export const template = {
  component: Email,
  subject: 'A match score has been contested',
  displayName: 'Contested Match Alert',
  previewData: {
    recipientName: 'Admin',
    contesterName: 'Alex Chen',
    matchSummary: 'Court 4 · 4.0 Mixed Doubles · Round 2',
    reason: 'Score disagrees with what was played',
    matchUrl: 'https://pulsepb.com',
  },
} satisfies TemplateEntry
