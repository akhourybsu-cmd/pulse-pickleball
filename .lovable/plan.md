

# Tournaments Showcase Page Architecture

## Overview

Create a proper tournament showcase/marketing page that serves as the entry point from the homepage. This page will explain what tournaments are, highlight the platform's features, and provide clear CTAs to either browse tournaments or create one.

---

## Current State

| Route | Component | Purpose |
|-------|-----------|---------|
| `/tournaments` | Redirect to `/tournaments/browse` | Direct to discovery |
| `/tournaments/browse` | `BrowseTournaments` | Public discovery page |
| `/tournaments/manage` | `ManageTournaments` | Owner management |
| (unused) | `TournamentsLanding` | Marketing/showcase page |

---

## Proposed Route Structure

```text
/tournaments              → TournamentsLanding (showcase page - NEW)
/tournaments/browse       → BrowseTournaments (existing)
/tournaments/manage       → ManageTournaments (existing)
/tournaments/new          → TournamentNewWithGating (existing)
```

---

## User Journey

```text
Homepage
   │
   └─── "Host a Tournament" tile
           │
           ▼
   Tournaments Landing (Showcase)
   ┌─────────────────────────────────┐
   │  Hero: "Professional Tournaments"│
   │  Features & Benefits             │
   │                                  │
   │  [Browse Tournaments]  [Create]  │
   │                                  │
   │  Featured tournaments preview    │
   │  Pricing section                 │
   └─────────────────────────────────┘
           │
           ├───── Browse Tournaments → /tournaments/browse
           │
           └───── Create Tournament → /tournaments/new
```

---

## Implementation Steps

### Step 1: Update Routing

Modify `src/App.tsx`:
- Change `/tournaments` from redirect to render `TournamentsLanding`
- Keep all other tournament routes as-is

**Before:**
```typescript
<Route path="/tournaments" element={<Navigate to="/tournaments/browse" replace />} />
```

**After:**
```typescript
<Route path="/tournaments" element={<TournamentsLanding />} />
```

### Step 2: Update TournamentsLanding Page

Transform the current page into a proper showcase:

1. **Keep existing sections:**
   - Hero with premium styling
   - Features showcase
   - Pricing section
   - Footer

2. **Modify the Hero CTAs:**
   - Primary: "Create Tournament" → `/tournaments/new`
   - Secondary: "Browse Tournaments" → `/tournaments/browse`

3. **Update "Browse Tournaments" section:**
   - Show only 3 featured tournaments (teaser)
   - Add prominent "View All Tournaments" button linking to `/tournaments/browse`
   - Remove the inline search (that's on the browse page now)

4. **Remove redundant elements:**
   - Remove inline search bar (belongs on browse page)
   - Simplify to 3 tournament cards max as a preview

### Step 3: Update TournamentHero Component

Modify the CTAs in `TournamentHero.tsx`:
- Primary button: "Create Tournament" (existing)
- Secondary button: Change from scroll-to-section to "Browse Tournaments" link → `/tournaments/browse`

---

## Updated Page Layout

### TournamentsLanding (Showcase)

```text
┌────────────────────────────────────────────────┐
│ Nav: [Logo]          [ThemeToggle] [Sign In]   │
├────────────────────────────────────────────────┤
│                                                │
│        🏆 Premium Tournament Platform          │
│                                                │
│     Host Professional Tournaments              │
│                                                │
│  [Create Tournament]  [Browse Tournaments]     │
│                                                │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐          │
│  │Automated│ │  Live   │ │ Secure  │          │
│  │Brackets │ │Scoring  │ │Register │          │
│  └─────────┘ └─────────┘ └─────────┘          │
├────────────────────────────────────────────────┤
│                                                │
│  My Tournaments (if logged in, max 3)          │
│  [View All → /tournaments/manage]              │
│                                                │
├────────────────────────────────────────────────┤
│                                                │
│  Featured Tournaments (max 3)                  │
│  [View All → /tournaments/browse]              │
│                                                │
├────────────────────────────────────────────────┤
│                                                │
│        💎 Simple Pricing                       │
│        Pricing cards                           │
│                                                │
├────────────────────────────────────────────────┤
│              Footer                            │
└────────────────────────────────────────────────┘
```

---

## File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| Modify | `src/App.tsx` | Change `/tournaments` to render `TournamentsLanding` |
| Modify | `src/pages/TournamentsLanding.tsx` | Update CTAs, limit cards to 3, add "View All" buttons |
| Modify | `src/components/tournament/TournamentHero.tsx` | Change secondary CTA to link to `/tournaments/browse` |

---

## Technical Details

### TournamentsLanding Changes

1. **Hero Section:** Keep as-is with updated secondary CTA

2. **My Tournaments Section:**
   - Keep current implementation
   - Update "View All" button to go to `/tournaments/manage`

3. **Browse Tournaments Section:**
   - Rename to "Featured Tournaments"
   - Remove search bar entirely
   - Limit to 3 cards
   - Add prominent "Browse All Tournaments" button → `/tournaments/browse`

4. **Pricing Section:** Keep as-is

### TournamentHero Changes

```typescript
// Before (scrolls to section)
<Button
  onClick={() => {
    document.getElementById("browse-tournaments")?.scrollIntoView({
      behavior: "smooth",
    });
  }}
>
  Browse Tournaments
</Button>

// After (navigates to browse page)
<Button
  onClick={() => navigate("/tournaments/browse")}
>
  Browse Tournaments
</Button>
```

---

## Navigation Flow Summary

| From | Action | To |
|------|--------|-----|
| Homepage "Host a Tournament" | Click | `/tournaments` (showcase) |
| Showcase Hero | "Create Tournament" | `/tournaments/new` |
| Showcase Hero | "Browse Tournaments" | `/tournaments/browse` |
| Showcase "My Tournaments" | "View All" | `/tournaments/manage` |
| Showcase "Featured" | "View All" | `/tournaments/browse` |
| Showcase Featured Card | Click card | `/tournament/:id` (landing) |

