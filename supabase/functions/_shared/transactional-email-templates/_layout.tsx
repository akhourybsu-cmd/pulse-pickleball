/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

export const BRAND = {
  primary: '#A9CF46',
  ink: '#0E1A24',
  inkSoft: '#1E2A36',
  muted: '#55636E',
  hairline: '#E6E9ED',
  surface: '#F4F6F8',
  white: '#ffffff',
  fontStack:
    "-apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif",
  logoUrl: 'https://pulsepb.com/pulse-icon.jpg',
  siteUrl: 'https://pulsepb.com',
}

export const styles = {
  main: { backgroundColor: BRAND.white, fontFamily: BRAND.fontStack, margin: 0 },
  outer: { maxWidth: '600px', margin: '0 auto', padding: '24px' },
  logoWrap: { textAlign: 'center' as const, padding: '32px 0 20px' },
  logo: { display: 'inline-block', borderRadius: '14px' },
  eyebrow: {
    textAlign: 'center' as const,
    fontSize: '11px',
    letterSpacing: '2px',
    color: BRAND.muted,
    textTransform: 'uppercase' as const,
    margin: '0 0 20px',
    fontWeight: 600 as const,
  },
  card: {
    background: BRAND.white,
    borderRadius: '16px',
    padding: '40px 32px',
    boxShadow: '0 2px 12px rgba(14, 26, 36, 0.08)',
    border: `1px solid ${BRAND.hairline}`,
  },
  h1: {
    color: BRAND.ink,
    margin: '0 0 16px',
    fontSize: '26px',
    fontWeight: 700 as const,
    lineHeight: 1.25,
    letterSpacing: '-0.01em',
  },
  h2: {
    color: BRAND.ink,
    margin: '0 0 12px',
    fontSize: '18px',
    fontWeight: 600 as const,
  },
  text: {
    color: BRAND.ink,
    fontSize: '16px',
    lineHeight: 1.65,
    margin: '0 0 16px',
  },
  small: {
    color: BRAND.muted,
    fontSize: '13px',
    lineHeight: 1.6,
    margin: '0 0 8px',
  },
  detailRow: {
    color: BRAND.ink,
    fontSize: '15px',
    lineHeight: 1.5,
    margin: '0 0 6px',
  },
  detailLabel: {
    color: BRAND.muted,
    fontSize: '12px',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
    fontWeight: 600 as const,
    margin: '0 0 2px',
  },
  detailBlock: {
    background: BRAND.surface,
    borderRadius: '12px',
    padding: '20px 22px',
    margin: '24px 0',
    borderLeft: `3px solid ${BRAND.primary}`,
  },
  btnWrap: { textAlign: 'center' as const, margin: '28px 0 12px' },
  button: {
    backgroundColor: BRAND.primary,
    color: BRAND.ink,
    fontSize: '15px',
    fontWeight: 700 as const,
    borderRadius: '10px',
    padding: '14px 36px',
    textDecoration: 'none',
    display: 'inline-block',
    letterSpacing: '0.01em',
  },
  link: { color: BRAND.ink, textDecoration: 'underline' },
  hr: { borderColor: BRAND.hairline, margin: '28px 0' },
  footer: {
    textAlign: 'center' as const,
    fontSize: '12px',
    color: BRAND.muted,
    margin: '20px 0 0',
    lineHeight: 1.6,
  },
  brandLink: { color: BRAND.muted, textDecoration: 'none', fontWeight: 600 as const },
  badge: {
    display: 'inline-block',
    background: BRAND.primary,
    color: BRAND.ink,
    fontSize: '11px',
    fontWeight: 700 as const,
    letterSpacing: '1.5px',
    textTransform: 'uppercase' as const,
    padding: '6px 12px',
    borderRadius: '999px',
    marginBottom: '16px',
  },
}

export interface LayoutProps {
  preview: string
  eyebrow?: string
  children: React.ReactNode
}

export const EmailLayout = ({ preview, eyebrow, children }: LayoutProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{preview}</Preview>
    <Body style={styles.main}>
      <Container style={styles.outer}>
        <Section style={styles.logoWrap}>
          <Img
            src={BRAND.logoUrl}
            alt="Pulse Pickleball"
            width="64"
            height="64"
            style={styles.logo}
          />
        </Section>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Container style={styles.card}>{children}</Container>
        <Text style={styles.footer}>
          <Link href={BRAND.siteUrl} style={styles.brandLink}>
            PULSE PICKLEBALL
          </Link>
          <br />
          You're receiving this because of activity on your account.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const CTA = ({ href, label }: { href: string; label: string }) => (
  <Section style={styles.btnWrap}>
    <Button style={styles.button} href={href}>
      {label}
    </Button>
  </Section>
)

export const DetailBlock = ({
  rows,
}: {
  rows: Array<{ label: string; value: string | React.ReactNode }>
}) => (
  <Section style={styles.detailBlock}>
    {rows.map((r, i) => (
      <div key={i} style={{ marginBottom: i === rows.length - 1 ? 0 : '14px' }}>
        <Text style={styles.detailLabel}>{r.label}</Text>
        <Text style={styles.detailRow}>{r.value}</Text>
      </div>
    ))}
  </Section>
)

export { Heading, Text, Hr, Link, Section }
