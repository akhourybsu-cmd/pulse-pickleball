/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your Pulse Pickleball email change</Preview>
    <Body style={main}>
      <Container style={outer}>
        <Section style={logoWrap}>
          <Img src="https://pulsepb.com/pulse-icon.jpg" alt="Pulse Pickleball" width="72" height="72" style={logo} />
        </Section>
        <Container style={card}>
          <Heading style={h1}>Confirm your email change</Heading>
          <Text style={text}>
            You requested to change the email on your Pulse Pickleball account from{' '}
            <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link> to{' '}
            <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
          </Text>
          <Section style={btnWrap}>
            <Button style={button} href={confirmationUrl}>Confirm Change</Button>
          </Section>
          <Text style={altLink}>
            Or paste this link into your browser:<br />
            <Link href={confirmationUrl} style={link}>{confirmationUrl}</Link>
          </Text>
          <Text style={footer}>
            Didn't request this? Please secure your account immediately.
          </Text>
        </Container>
        <Text style={brand}>
          <Link href="https://pulsepb.com" style={brandLink}>PulsePB.com</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif" }
const outer = { maxWidth: '600px', margin: '0 auto', padding: '24px' }
const logoWrap = { textAlign: 'center' as const, padding: '32px 0 24px' }
const logo = { display: 'inline-block', borderRadius: '12px' }
const card = { background: '#ffffff', borderRadius: '12px', padding: '40px 32px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
const h1 = { color: '#0E1A24', margin: '0 0 20px', fontSize: '24px', fontWeight: 600 as const, lineHeight: 1.3 }
const text = { color: '#0E1A24', fontSize: '16px', lineHeight: 1.6, margin: '0 0 24px' }
const btnWrap = { textAlign: 'center' as const, margin: '32px 0' }
const button = { backgroundColor: '#A9CF46', color: '#0E1A24', fontSize: '16px', fontWeight: 600 as const, borderRadius: '8px', padding: '16px 40px', textDecoration: 'none', display: 'inline-block' }
const altLink = { fontSize: '13px', color: '#55636E', wordBreak: 'break-all' as const, margin: '24px 0 0', padding: '16px', background: '#F4F6F8', borderRadius: '8px', borderLeft: '3px solid #A9CF46' }
const link = { color: '#0E1A24', textDecoration: 'underline' }
const footer = { fontSize: '13px', color: '#55636E', margin: '24px 0 0', paddingTop: '20px', borderTop: '1px solid #E6E9ED' }
const brand = { textAlign: 'center' as const, fontSize: '12px', color: '#8A95A0', margin: '24px 0' }
const brandLink = { color: '#A9CF46', textDecoration: 'none' }
