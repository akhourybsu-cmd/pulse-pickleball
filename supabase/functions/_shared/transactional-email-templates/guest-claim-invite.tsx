/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1';
import type { TemplateEntry } from './registry.ts';
import { EmailLayout, CTA, Text, styles } from './_layout.tsx';

const Email = ({ claimUrl = 'https://pulsepb.com' }: { claimUrl?: string }) => (
  <EmailLayout preview="Connect your guest playing history to your PULSE account" eyebrow="Your guest profile">
    <Text style={styles.h1}>Keep your games with you.</Text>
    <Text style={styles.text}>Your organizer invited you to connect your guest profile to PULSE. Sign in or create an account to see your round robins and keep your match history together.</Text>
    <CTA href={claimUrl} label="Claim my guest profile" />
    <Text style={styles.text}>Use this email address for automatic linking. If you use another address, your organizer will review the request. This invitation expires after 30 days.</Text>
    <Text style={styles.text}>If this invitation isn't for you, you can ignore it.</Text>
  </EmailLayout>
);
export const template = {
  component: Email, subject: 'Your PULSE guest profile is ready to claim',
  displayName: 'Guest profile invitation', previewData: { claimUrl: 'https://pulsepb.com' },
} satisfies TemplateEntry;
