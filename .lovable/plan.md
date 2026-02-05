

# Tournament UX Polish: Premium Hierarchy and Role-Aware Navigation

## Overview

This plan implements the s-specs recommendations to elevate the tournament experience from "good" to "premium" by:
1. Promoting tournaments on the homepage via a dedicated spotlight section
2. Adding role-aware framing (Player vs Organizer) to the tournament landing page
3. Restructuring the mobile sandwich menu with grouped navigation

All changes follow existing PULSE design patterns and maintain consistency across the platform.

---

## Part 1: Homepage Tournament Spotlight

### Current State
The homepage has tournaments presented in two places:
- **Secondary link:** "Join a Tournament" inline text below hero CTAs
- **Quick Action Tile:** "Host a Tournament" card in the Quick Actions section

### Problem
These two placements compete with fundamentally different intents and flatten importance. The "Join a Tournament" link treats a commitment-driven action as a footer item.

### Solution
Replace the inline "Join a Tournament" text link with a **Tournament Spotlight** card section positioned after the DualLaneSection, giving tournaments proper visual weight.

### New Component: TournamentSpotlight

Location after DualLaneSection, before QuickActionTiles:

```
+------------------------------------------+
|  🏆 Tournaments                          |
|                                          |
|  "Join live or upcoming tournaments"     |
|                                          |
|  [Browse Tournaments]  [Host a Tournament]|
+------------------------------------------+
```

**Design specs:**
- Compact card with gradient border (matches premium styling)
- Trophy icon with primary color glow
- Two horizontal CTAs: "Browse Tournaments" (primary) and "Host a Tournament" (outline)
- Mobile: CTAs stack vertically

### Changes to Existing Files

**HeroSection.tsx:**
- Remove the "Join a Tournament" secondary link
- Keep "Browse Venues" and "Create a Round Robin"

**QuickActionTiles.tsx:**
- Remove the "Host a Tournament" tile (now in spotlight)
- Reduce to 3 tiles: Track Your Pulse, Find Places to Play, Run a Round Robin

**Index.tsx:**
- Add TournamentSpotlight component between DualLaneSection and QuickActionTiles

---

## Part 2: Tournament Landing Page - Role-Aware Framing

### Current State
The tournament landing page hero assumes users want to host ("Host Professional Tournaments"). Players looking to join feel like they landed on a sales page.

### Solution
Add a **role fork** immediately below the hero, visually distinguishing the two user intents.

### New Component: TournamentRoleFork

```
+------------------------------------------+
|  Two Cards Side by Side                  |
|                                          |
|  +----------------+  +----------------+  |
|  | 🎯 For Players |  | 🏢 For         |  |
|  |                |  |    Organizers  |  |
|  | "Find and join |  | "Host with     |  |
|  |  tournaments"  |  |  automated     |  |
|  |                |  |  tools"        |  |
|  | [Browse]       |  | [Create]       |  |
|  +----------------+  +----------------+  |
|                                          |
+------------------------------------------+
```

**Design specs:**
- Full-width section with muted background gradient
- Two cards using existing Card component styling
- Player card: Trophy icon, primary border hover
- Organizer card: Settings/Wrench icon, secondary accent
- Mobile: Cards stack vertically, player card first

### Changes to TournamentsLanding.tsx

Insert the TournamentRoleFork section immediately after TournamentHero and before the "My Tournaments" section.

### Hero Adjustments

Update TournamentHero.tsx to be more role-neutral:
- Change headline from "Host Professional Tournaments" to "Professional Pickleball Tournaments"
- Update subtext to be inclusive: "Join competitive events or host your own with automated brackets, live scoring, and seamless registration."
- Keep both CTAs but with neutral ordering

---

## Part 3: Mobile Sandwich Menu Restructuring

### Current State
The mobile menu in HomepageNav.tsx has a flat list:
- Players
- Venues  
- Events
- Community
- Login (if not logged in)
- CTA button

### Problem
As Pulse grows, a flat list doesn't scale. Tournaments aren't represented at all. The menu feels like "explore" rather than "platform."

### Solution
Restructure the menu with grouped navigation sections:

```
┌────────────────────────────────┐
│  [PULSE Logo]                  │
├────────────────────────────────┤
│  EXPLORE                       │
│    Players                     │
│    Venues                      │
│    Events                      │
│    Community                   │
├────────────────────────────────┤
│  PLAY                          │
│    Round Robins                │
│    Tournaments  ▸              │
│      └─ Browse Tournaments     │
│      └─ Host a Tournament      │
├────────────────────────────────┤
│  (if logged in)                │
│  ACCOUNT                       │
│    Dashboard                   │
│    My Profile                  │
│    Settings                    │
└────────────────────────────────┘
│  [Get Started / Dashboard]     │
└────────────────────────────────┘
```

### Implementation in HomepageNav.tsx

**Structure the navLinks into groups:**

```typescript
const menuSections = {
  explore: [
    { label: "Players", href: "/players", icon: User },
    { label: "Venues", href: "/venues", icon: Building2 },
    { label: "Events", href: "/browse-events", icon: Calendar },
    { label: "Community", href: "/player/community", icon: Users },
  ],
  play: [
    { label: "Round Robins", href: "/round-robin", icon: RotateCcw },
    { 
      label: "Tournaments", 
      icon: Trophy,
      submenu: [
        { label: "Browse Tournaments", href: "/tournaments/browse" },
        { label: "Host a Tournament", href: "/tournaments/new" },
      ]
    },
  ],
  account: [
    { label: "Dashboard", href: "/player/dashboard", icon: LayoutDashboard },
    { label: "My Profile", href: "/profile", icon: User },
    { label: "Settings", href: "/settings", icon: Settings },
  ],
};
```

**Visual design:**
- Section headers: text-xs uppercase text-muted-foreground with tracking-wider
- Subtle dividers between sections (border-t border-border/50)
- Collapsible submenu for Tournaments using Collapsible component
- Increased vertical padding between groups (py-4)
- Subtle expand animation on submenu

---

## File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| Create | `src/components/homepage/TournamentSpotlight.tsx` | New spotlight card for homepage |
| Create | `src/components/tournament/TournamentRoleFork.tsx` | Player vs Organizer role selector |
| Modify | `src/components/homepage/HeroSection.tsx` | Remove "Join a Tournament" link |
| Modify | `src/components/homepage/QuickActionTiles.tsx` | Remove "Host a Tournament" tile |
| Modify | `src/components/homepage/index.ts` | Export TournamentSpotlight |
| Modify | `src/pages/Index.tsx` | Add TournamentSpotlight to layout |
| Modify | `src/pages/TournamentsLanding.tsx` | Add TournamentRoleFork section |
| Modify | `src/components/tournament/TournamentHero.tsx` | Make headline role-neutral |
| Modify | `src/components/homepage/HomepageNav.tsx` | Restructure mobile menu with sections |

---

## Technical Specifications

### TournamentSpotlight Component

```typescript
interface TournamentSpotlightProps {}

// Styling: 
// - Container: py-12 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5
// - Inner card: max-w-2xl mx-auto, border-primary/20, shadow-lg
// - Trophy icon with shadow-[0_0_20px_rgba(169,207,70,0.3)]
```

### TournamentRoleFork Component

```typescript
interface TournamentRoleForkProps {
  onBrowseClick?: () => void;
  onCreateClick?: () => void;
}

// Uses framer-motion for entrance animation
// Cards use hover:scale-[1.02] and hover:shadow-lg transitions
```

### Mobile Menu Submenu Behavior

- Uses Radix Collapsible component (already installed)
- ChevronDown icon rotates on expand
- Submenu items indented with pl-8
- Fast 150ms animation duration

---

## Consistency Checklist

- [ ] All new components use existing design tokens (primary, secondary, muted-foreground)
- [ ] Cards match existing Card component patterns (border-border/50, rounded-2xl)
- [ ] Buttons use existing size variants (sm, lg) and variants (default, outline, ghost)
- [ ] Mobile touch targets meet 44px minimum
- [ ] Animation timings consistent (300ms for cards, 150ms for menu)
- [ ] Icons from lucide-react (already in use throughout)

---

## Mobile-First Considerations

**TournamentSpotlight:**
- Full-width on mobile with horizontal padding
- CTAs stack vertically on screens < sm

**TournamentRoleFork:**
- Cards stack vertically on mobile
- Player card appears first (higher intent for players)

**Mobile Menu:**
- Touch-friendly submenu expansion
- Visual affordance (chevron) for expandable items
- Sections clearly separated with padding

