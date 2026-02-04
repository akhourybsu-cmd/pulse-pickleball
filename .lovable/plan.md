

# Browse Tournaments Header and Mobile Redesign

## Overview

Redesign the Browse Tournaments page to use a standardized tournament header consistent with other PULSE pages, and streamline the mobile experience by reducing the oversized hero section and consolidating filters into a more compact, premium layout.

---

## Current Issues

| Issue | Description |
|-------|-------------|
| Inconsistent header | Uses `PageHeader` which is player-dashboard focused, not tournament-discovery focused |
| Oversized hero | 280px min-height takes too much screen space on mobile before users see content |
| Cluttered filters | Two separate filter rows take significant vertical space |
| No mobile optimization | Filter pills don't scroll horizontally, can wrap awkwardly on small screens |
| Missing navigation | No clear way to navigate between Browse and Manage Tournaments |

---

## Solution: New Tournament Header Component

Create a new `TournamentBrowseHeader` component that:

1. Matches the height standard (72px desktop, 64px mobile)
2. Uses the PULSE logo like other headers
3. Includes contextual navigation (Browse vs Manage tabs)
4. Has the standard ThemeToggle
5. Shows Login/Dashboard CTA based on auth state

### Header Layout

```text
Desktop:
[PULSE Logo]    [Browse | Manage Tournaments]    [ThemeToggle] [Login/Dashboard]

Mobile:
[PULSE Logo]                                      [ThemeToggle] [Menu]
```

---

## Solution: Streamlined Hero and Search

Replace the current large hero with a compact, integrated search bar that doubles as the page header:

### New Layout (Mobile-First)

```text
Standard Header (64-72px)
--------------------------
Compact Hero with inline search (120px max)
  - Title: "Find Tournaments"
  - Subtitle: brief tagline
  - Single search bar with location toggle
--------------------------
Horizontal scrolling filter chips
--------------------------
Results grid
```

### Key Changes

1. **Remove 280px hero** - Replace with compact 120px header section
2. **Combine search inputs** - Single smart search bar (searches both name and location)
3. **Horizontal scroll filters** - Chips scroll horizontally on mobile with fade hints
4. **Remove "Browse All" button** - Users are already on the browse page

---

## Implementation Details

### New Files

| File | Purpose |
|------|---------|
| `src/components/tournament/TournamentBrowseHeader.tsx` | Standardized tournament header |

### Modified Files

| File | Changes |
|------|---------|
| `src/pages/BrowseTournaments.tsx` | Replace PageHeader with TournamentBrowseHeader, redesign hero |
| `src/components/tournament/TournamentBrowseFilters.tsx` | Horizontal scroll, combined layout |

---

## Header Component Design

The new `TournamentBrowseHeader` will:

- Use `bg-secondary` background (consistent with PageHeader)
- 72px height (standard PULSE header height)
- Include PULSE logo linking to homepage or player dashboard
- Navigation tabs for "Browse" and "Manage" (if authenticated)
- Theme toggle
- Login button or Dashboard button based on auth state
- Mobile-responsive with hamburger menu for extra options

---

## Compact Hero Design

```text
py-6 on mobile, py-8 on desktop (reduced from py-12)
Max height: ~120px vs current ~280px

Layout:
+----------------------------------------+
|  Find Tournaments                       |
|  Discover events near you               |
|                                         |
|  [Search icon] Search by name or city...|
+----------------------------------------+
```

---

## Improved Filter Bar

Single horizontal row with:
- Horizontally scrollable chips on mobile
- Fade gradient hints at edges
- Combined date and registration filters
- Clear filters button at the end

```text
[All Dates] [This Week] [This Month] [Next 3 Mo] | [Open Now] [Opening Soon] [Clear X]
                    ← scrollable on mobile →
```

---

## Technical Specifications

### TournamentBrowseHeader Props

```typescript
interface TournamentBrowseHeaderProps {
  userId?: string | null;
  activeTab?: 'browse' | 'manage';
}
```

### Filter Component Updates

- Add `overflow-x-auto` with `scrollbar-hide` utility
- Add gradient fade masks using `mask-image`
- Combine date and registration into single row
- Mobile: all filters in horizontal scroll container

---

## Mobile Viewport Optimization

| Element | Current | New |
|---------|---------|-----|
| Header | 72px | 64px (mobile) |
| Hero | ~280px | ~100px |
| Filters | ~140px (2 rows) | ~48px (1 scrollable row) |
| **Above-fold content** | **~492px** | **~212px** |

This gives users ~280px more visible content above the fold on mobile.

---

## Visual Summary

### Before (Mobile)
```text
+------------------+
| PageHeader  72px |
+------------------+
|                  |
|   Big Hero      |
|   280px         |
|   Trophy Icon   |
|   Button        |
|                  |
+------------------+
| Filter Row 1    |
+------------------+
| Filter Row 2    |
+------------------+
| Results...      |
```

### After (Mobile)
```text
+------------------+
| Header     64px  |
| [Logo][Tab][CTA] |
+------------------+
| Find Tournaments |
| [Search bar]    |
+------------------+
| [chips scroll →]|
+------------------+
| 3 tournaments   |
| +-------------+ |
| | Card 1      | |
| +-------------+ |
```

---

## File Changes Summary

| Action | File |
|--------|------|
| Create | `src/components/tournament/TournamentBrowseHeader.tsx` |
| Modify | `src/pages/BrowseTournaments.tsx` |
| Modify | `src/components/tournament/TournamentBrowseFilters.tsx` |

