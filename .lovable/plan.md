

# Tournament Landing Page Complete Makeover

## Overview

Transform the individual tournament homepage (`/tournament/:slug`) from a "digital brochure" into a **premium, conversion-optimized experience** that entices players to register. The redesign removes header clutter, implements sophisticated information architecture, and creates an aspirational sports-event aesthetic.

---

## Current State Analysis

### Problems Identified

1. **Clunky Header**: The `PageHeader` component includes multiple elements (notification bell, profile icon, mode switcher, sign out) that distract from the tournament content and are irrelevant for public visitors
2. **Information Overload**: Content is presented in long, scrollable sections without visual hierarchy or scannable modules
3. **Weak Registration CTA**: The register button is buried inside a card rather than being a persistent, attention-grabbing element
4. **No Urgency/FOMO**: Missing real-time registration counts, countdown timers, or spots-remaining indicators
5. **Generic Visual Design**: The hero section lacks the immersive, premium feel of modern sports platforms

### Current Flow
```
PageHeader (full nav) → Hero Card → About → Quick Facts → Divisions → Venue → Sponsors → Contact → Footer CTA
```

---

## New Design Vision

### Design Principles
- **Immersive First Impression**: Full-bleed hero with minimal chrome
- **Action-Oriented Layout**: Sticky registration bar visible at all times
- **Scannable Information**: Icon-driven modules, not text walls
- **Social Proof & Urgency**: Live registration counts, spots remaining, countdown
- **Mobile-First**: Touch-friendly, thumb-zone-optimized CTAs

---

## Technical Implementation

### Phase 1: New Minimal Tournament Header Component

Create a new `TournamentPublicHeader` component specifically for public tournament pages:

**File**: `src/components/tournament/TournamentPublicHeader.tsx`

```typescript
// Ultra-minimal header for public tournament pages
- Transparent background overlaying hero
- Small PULSE logo (left)
- Share button + Theme toggle (right)
- No auth buttons, notifications, or mode switcher
- Fades in on scroll
```

**Key Features**:
- `position: sticky` with transparent-to-solid transition on scroll
- Only 48px height (vs current 72px)
- Logo links to `/tournaments` (browse all)
- Share and Theme toggle only

---

### Phase 2: Immersive Hero Section Redesign

Replace the current card-in-hero pattern with a full-bleed, cinematic hero:

**New Structure**:
```
┌─────────────────────────────────────────────────┐
│  [Minimal Header - transparent overlay]         │
├─────────────────────────────────────────────────┤
│                                                 │
│     Full-bleed Hero Image/Video                 │
│     with gradient overlay                       │
│                                                 │
│     ┌───────────────────────────────────┐       │
│     │  Status Badge: "Registration Open"│       │
│     │                                   │       │
│     │  TOURNAMENT NAME                  │       │
│     │  Tagline / Dates / Location       │       │
│     │                                   │       │
│     │  ┌─────────────┐ ┌─────────────┐  │       │
│     │  │ REGISTER $X │ │   SHARE     │  │       │
│     │  └─────────────┘ └─────────────┘  │       │
│     └───────────────────────────────────┘       │
│                                                 │
│     ▼ Scroll for Details                        │
└─────────────────────────────────────────────────┘
```

**Implementation Details**:
- Full viewport height on desktop, 70vh on mobile
- Parallax background image effect
- Animated gradient overlay (primary to transparent)
- Registration CTA with glow effect and hover animation
- Countdown timer if registration closes within 7 days

---

### Phase 3: Sticky Registration Bar

Create a persistent bottom bar that appears after scrolling past the hero:

**File**: `src/components/tournament/TournamentStickyBar.tsx`

```typescript
// Sticky bottom bar with registration CTA
- Appears on scroll (after hero exits viewport)
- Shows: Event name (truncated) | Price | "Register Now" button
- Full-width on mobile, centered max-width on desktop
- Glassmorphism background (backdrop-blur)
```

---

### Phase 4: Redesigned Content Sections

#### Section A: "At a Glance" Quick Facts Grid

Replace the sidebar card with a horizontal grid of scannable metrics:

```
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ 📅     │ │ 📍     │ │ 💵     │ │ 🏆     │ │ 👥     │
│ Mar 15 │ │Austin  │ │  $40   │ │ Bracket│ │ 24/48  │
│ Dates  │ │Location│ │Entry   │ │Format  │ │Spots   │
└────────┘ └────────┘ └────────┘ └────────┘ └────────┘
```

**Implementation**:
- Horizontal scroll on mobile
- 5-column grid on desktop
- Animated count-up for spots remaining
- "Almost Full" badge when >75% capacity

#### Section B: Division Cards with Urgency

Redesign division cards to show registration status and drive action:

```
┌─────────────────────────────────────┐
│ Men's 4.0+ Doubles                  │
│ ─────────────────────────────────── │
│ Format: Round Robin → Bracket       │
│ Teams: 12/16 registered             │
│ ████████████░░░░ 75%                │
│                                     │
│ [Register for This Division]        │
└─────────────────────────────────────┘
```

**Features**:
- Progress bar showing fill rate
- "X spots left!" urgency text
- Skill level badge
- One-tap registration

#### Section C: Venue Experience Module

Create an immersive venue preview:

```
┌─────────────────────────────────────────────────┐
│                                                 │
│  [Large Venue Photo - 16:9 ratio]               │
│                                                 │
├─────────────────────────────────────────────────┤
│  Venue Name                                     │
│  ─────────────                                  │
│  ✓ 12 Indoor Courts  ✓ Pro Shop  ✓ Free Parking│
│                                                 │
│  [View Map]  [Get Directions]                   │
└─────────────────────────────────────────────────┘
```

---

### Phase 5: Social Proof Section (New)

Add a new section to build credibility:

```typescript
// New component: TournamentSocialProof.tsx
- Live registration count: "47 teams already registered"
- Testimonials from past participants (if available)
- "Add to Calendar" integration
- Social share buttons with share count
```

---

### Phase 6: Streamlined Page Structure

**New Component Architecture**:

```
src/components/tournament/landing/
├── TournamentPublicHeader.tsx    // Minimal header
├── TournamentHeroSection.tsx     // Full-bleed hero
├── TournamentQuickFacts.tsx      // Horizontal metrics grid
├── TournamentDivisionsGrid.tsx   // Redesigned division cards
├── TournamentVenueModule.tsx     // Immersive venue preview
├── TournamentSocialProof.tsx     // Registration counts + social
├── TournamentPoliciesAccordion.tsx // Collapsible policies
├── TournamentContactCard.tsx     // Organizer contact
├── TournamentStickyBar.tsx       // Bottom registration bar
└── TournamentFooterCTA.tsx       // Final conversion push
```

**Refactored TournamentLanding.tsx**:

```typescript
export default function TournamentLanding() {
  // ... data fetching logic stays similar
  
  return (
    <div className="min-h-screen bg-background">
      {/* Minimal header - NOT PageHeader */}
      <TournamentPublicHeader 
        tournamentName={event.name}
        onShare={handleShare}
      />
      
      {/* Full-bleed hero */}
      <TournamentHeroSection
        event={event}
        customization={customization}
        onRegister={() => navigate(`/tournament/${event.id}/register`)}
      />
      
      {/* Quick facts grid */}
      <TournamentQuickFacts event={event} />
      
      {/* Divisions with urgency */}
      <TournamentDivisionsGrid 
        divisions={event.divisions}
        eventId={event.id}
      />
      
      {/* About section */}
      {customization?.about_markdown && (
        <TournamentAboutSection content={customization.about_markdown} />
      )}
      
      {/* Venue experience */}
      <TournamentVenueModule customization={customization} />
      
      {/* Social proof */}
      <TournamentSocialProof eventId={event.id} />
      
      {/* Sponsors */}
      <TournamentSponsorsGrid sponsors={customization?.sponsors} />
      
      {/* Policies accordion */}
      <TournamentPoliciesAccordion customization={customization} />
      
      {/* Contact */}
      <TournamentContactCard customization={customization} />
      
      {/* Final CTA */}
      <TournamentFooterCTA 
        userId={userId}
        onRegister={() => navigate(`/tournament/${event.id}/register`)}
      />
      
      {/* Sticky registration bar */}
      <TournamentStickyBar
        eventName={event.name}
        fee={event.registration_fee}
        onRegister={() => navigate(`/tournament/${event.id}/register`)}
      />
    </div>
  );
}
```

---

## Files to Create/Modify

### New Files (9)
1. `src/components/tournament/landing/TournamentPublicHeader.tsx`
2. `src/components/tournament/landing/TournamentHeroSection.tsx`
3. `src/components/tournament/landing/TournamentQuickFacts.tsx`
4. `src/components/tournament/landing/TournamentDivisionsGrid.tsx`
5. `src/components/tournament/landing/TournamentVenueModule.tsx`
6. `src/components/tournament/landing/TournamentSocialProof.tsx`
7. `src/components/tournament/landing/TournamentPoliciesAccordion.tsx`
8. `src/components/tournament/landing/TournamentContactCard.tsx`
9. `src/components/tournament/landing/TournamentStickyBar.tsx`

### Modified Files (2)
1. `src/pages/TournamentLanding.tsx` - Complete restructure to use new components
2. `src/index.css` - Add tournament-specific utility classes

---

## Visual Design Specifications

### Color Usage
- Primary CTA: `bg-gradient-to-r from-primary to-accent` with glow
- Status badges: Green (open), Orange (closing soon), Red (full)
- Progress bars: Primary color fill

### Typography
- Hero title: `text-5xl md:text-7xl font-bold`
- Section headers: `text-3xl font-bold`
- Quick facts: `text-2xl font-bold` (values), `text-sm text-muted-foreground` (labels)

### Spacing
- Section padding: `py-16 md:py-24`
- Component gaps: `gap-6 md:gap-8`
- 8pt grid system maintained

### Animations
- Hero: Parallax scroll, fade-in on load
- Quick facts: Staggered reveal on scroll
- Division cards: Hover lift + glow
- Sticky bar: Slide-up entrance

---

## Mobile Optimizations

- Hero: 70vh with bottom-anchored CTA card
- Quick facts: Horizontal scroll with snap points
- Divisions: Full-width cards with touch-friendly 48px buttons
- Sticky bar: Fixed bottom with safe-area padding
- Share: Native share sheet on supported devices

---

## Expected Outcomes

1. **Reduced Header Clutter**: From 6+ nav elements to just logo + share
2. **Increased Registration Rate**: Persistent CTA visibility + urgency indicators
3. **Premium Aesthetic**: Immersive hero, glassmorphism, smooth animations
4. **Better Information Architecture**: Scannable modules vs text walls
5. **Mobile-First UX**: Touch-optimized, thumb-zone CTAs

