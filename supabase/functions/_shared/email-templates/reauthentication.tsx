/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
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

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Pulse Pickleball verification code</Preview>
    <Body style={main}>
      <Container style={outer}>
        <Section style={logoWrap}>
          <Img src="https://pulsepb.com/pulse-icon.jpg" alt="Pulse Pickleball" width="72" height="72" style={logo} />
        </Section>
        <Container style={card}>
          <Heading style={h1}>Confirm it's you</Heading>
          <Text style={text}>Enter this code to confirm your identity:</Text>
          <Text style={codeStyle}>{token}</Text>
          <Text style={footer}>
            This code expires shortly. Didn't request it? You can safely ignore this email.
          </Text>
        </Container>
        <Text style={brand}>
          <Link href="https://pulsepb.com" style={brandLink}>PulsePB.com</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "-apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif" }
const outer = { maxWidth: '600px', margin: '0 auto', padding: '24px' }
const logoWrap = { textAlign: 'center' as const, padding: '32px 0 24px' }
const logo = { display: 'inline-block', borderRadius: '12px' }
const card = { background: '#ffffff', borderRadius: '12px', padding: '40px 32px', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
const h1 = { color: '#0E1A24', margin: '0 0 20px', fontSize: '24px', fontWeight: 600 as const, lineHeight: 1.3 }
const text = { color: '#0E1A24', fontSize: '16px', lineHeight: 1.6, margin: '0 0 16px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '32px', fontWeight: 700 as const, color: '#0E1A24', letterSpacing: '6px', textAlign: 'center' as const, background: '#F4F6F8', borderRadius: '8px', padding: '20px', margin: '0 0 24px' }
const footer = { fontSize: '13px', color: '#55636E', margin: '24px 0 0', paddingTop: '20px', borderTop: '1px solid #E6E9ED' }
const brand = { textAlign: 'center' as const, fontSize: '12px', color: '#8A95A0', margin: '24px 0' }
const brandLink = { color: '#A9CF46', textDecoration: 'none' }
