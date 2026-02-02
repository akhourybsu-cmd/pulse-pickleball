
# Dark Mode Optimization Plan

## Executive Summary
The PULSE application has a well-structured dark mode foundation with comprehensive HSL CSS custom properties in `index.css`. However, numerous components and pages contain hardcoded light-mode colors (hex values, `bg-white`, `#ffffff`) that break the dark mode experience. This plan addresses all identified issues systematically.

## Current State Analysis

### What Works Well
- **CSS Custom Properties**: Dark mode variables are properly defined in `:root` and `.dark` selectors
- **UI Primitives**: Core shadcn/ui components (Button, Card, Dialog, Sheet, Dropdown, Select, Popover, Tabs) correctly use theme tokens (`bg-background`, `bg-popover`, `text-foreground`)
- **Theme Provider**: `next-themes` is properly configured in `App.tsx`
- **Sonner Toasts**: Already theme-aware with correct token usage

### Identified Issues (35+ instances)

#### Category 1: Hardcoded Page Headers with Light-Mode Gradients (Critical)
These pages use inline styles with hardcoded light colors that appear as harsh white sections in dark mode:

| File | Issue |
|------|-------|
| `EditProfile.tsx:340` | `background: 'linear-gradient(180deg, #E8FBD5 0%, #FFFFFF 80%)'` |
| `FAQ.tsx:33` | Same light-mode gradient |
| `MatchHistory.tsx:517` | Same light-mode gradient |
| `CourtBoard.tsx:160` | `background: 'linear-gradient(180deg, #e9f8dc 0%, #ffffff 100%)'` |
| `CourtBoard.tsx:305` | `background: '#ffffff'` |

#### Category 2: Hardcoded Component Styling (High)
Components with fixed colors that ignore the theme:

| File | Issue | Fix |
|------|-------|-----|
| `VenueInfoCard.tsx:70` | `bg-white`, `style={{ borderColor: '#e5f3d9' }}` | Use `bg-card`, `border-border` |
| `VenueInfoCard.tsx:72-88` | Hardcoded `color: '#0E4C58'` throughout | Use `text-foreground`, `text-muted-foreground` |
| `SwipeToConfirm.tsx:226` | `bg-white` on confirmed state handle | Use `bg-card` or `bg-background` |
| `NotificationBell.tsx:43` | `bg-lime-300 text-slate-900` badge | Use theme-aware colors |

#### Category 3: Venue Public/White-Label Pages (Medium)
These intentionally use hardcoded colors for branding but need dark mode fallbacks:

| File | Issue |
|------|-------|
| `PublicEventsTab.tsx:201` | `bg-white text-slate-900` for selected state |
| `VenueDetailSheet.tsx:115` | `color: '#FFFFFF'` hardcoded |
| `TournamentCustomize.tsx:805` | Sample buttons with `bg-gray-100 text-gray-900` |

#### Category 4: Admin/Kiosk Intentionally Dark (Acceptable)
These use a fixed dark theme by design - no changes needed:
- `AdminDashboard.tsx` - "Command Center" aesthetic with `bg-[#0B171F]`
- `VenueRoundRobinKiosk.tsx` - Kiosk theme objects

#### Category 5: Skill Level Colors (Low)
Fixed semantic colors that are acceptable but could use better dark mode contrast:
- `DayCalendarGrid.tsx:42-47` - `bg-gray-500`, `bg-green-500`, etc.

#### Category 6: Manifest/Infrastructure (Low)
- `public/manifest.json:7` - `background_color: "#ffffff"` - Should support dark preference

## Implementation Plan

### Phase 1: Critical Hero Headers (Highest Priority)
Replace hardcoded inline gradients with CSS variable-based gradients that adapt to theme.

**Files to Update:**
1. `src/pages/EditProfile.tsx` - Lines 339-342
2. `src/pages/FAQ.tsx` - Lines 32-35
3. `src/pages/MatchHistory.tsx` - Lines 516-519
4. `src/pages/CourtBoard.tsx` - Lines 159-162, 304-307

**Solution Pattern:**
Replace inline styles with Tailwind classes that reference CSS variables:
```
// Before
style={{
  background: 'linear-gradient(180deg, #E8FBD5 0%, #FFFFFF 80%)',
  borderBottom: '1px solid rgba(169, 220, 61, 0.15)',
}}

// After
className="bg-gradient-to-b from-primary/10 via-background to-background border-b border-primary/15"
```

### Phase 2: Component Dark Mode Fixes

**VenueInfoCard.tsx - Full Rewrite:**
- Replace `bg-white` with `bg-card`
- Replace hardcoded `color` styles with Tailwind classes
- Replace hardcoded border colors with `border-border`

**SwipeToConfirm.tsx:**
- Replace `bg-white` on confirmed handle with `bg-card`

**NotificationBell.tsx:**
- Make badge colors theme-aware using `bg-primary` and `text-primary-foreground`

### Phase 3: Public/White-Label Components

**PublicEventsTab.tsx:**
- Add dark mode variant: `bg-white text-slate-900 dark:bg-card dark:text-foreground`

**VenueDetailSheet.tsx:**
- Use contrast calculation or ensure text is visible on dynamic backgrounds

### Phase 4: CSS Variable Additions
Add new gradient variables to `index.css` for page heroes:

```css
/* Light mode */
--hero-gradient-from: 74 65% 52% / 0.1;
--hero-gradient-to: 0 0% 100%;

/* Dark mode */
.dark {
  --hero-gradient-from: 85 64% 61% / 0.08;
  --hero-gradient-to: 207 44% 10%;
}
```

### Phase 5: Manifest Update
Update `public/manifest.json` to use a neutral dark color that works in both modes.

## Technical Implementation Details

### New CSS Classes to Add (index.css)
```css
/* Hero Section Gradient - Theme Aware */
.hero-gradient {
  background: linear-gradient(180deg, 
    hsl(var(--hero-gradient-from)) 0%, 
    hsl(var(--background)) 100%
  );
}

/* Premium Card with Dark Mode Glow */
.card-glow-dark {
  @apply dark:shadow-[0_0_20px_hsl(var(--primary)/0.08)];
}
```

### Files to Modify (22 Total)

**CSS/Config:**
1. `src/index.css` - Add new gradient variables
2. `public/manifest.json` - Update background_color

**Pages with Hero Headers:**
3. `src/pages/EditProfile.tsx`
4. `src/pages/FAQ.tsx`
5. `src/pages/MatchHistory.tsx`
6. `src/pages/CourtBoard.tsx`

**Components with Hardcoded Colors:**
7. `src/components/VenueInfoCard.tsx`
8. `src/components/SwipeToConfirm.tsx`
9. `src/components/NotificationBell.tsx`
10. `src/components/reservations/DayCalendarGrid.tsx`
11. `src/components/venue-public/PublicEventsTab.tsx`
12. `src/components/player/VenueDetailSheet.tsx`
13. `src/pages/TournamentCustomize.tsx`

**Additional Pages with Hardcoded Text Colors:**
14. `src/pages/ViewProfile.tsx` (if any)
15. `src/pages/CourtSettings.tsx` (if any)
16. `src/pages/CourtHistory.tsx` (if any)

## Expected Outcomes

1. **Consistent Dark Mode**: All page headers, cards, and components will properly adapt to the dark theme
2. **No White Flashes**: Eliminated harsh white backgrounds that break dark mode immersion
3. **Proper Contrast**: Text remains readable in both modes
4. **Maintained Branding**: Admin "Command Center" aesthetic preserved
5. **Semantic Colors Intact**: Skill level indicators and status badges retain meaning

## Testing Checklist
- Dashboard view in dark mode
- Edit Profile page hero section
- FAQ page hero section
- Match History page header
- Court Board page styling
- Notification bell badge
- Swipe to confirm component
- Venue detail sheet
- Tournament customization preview
- Public venue pages

## Notes
- The Admin dashboard intentionally uses a fixed dark "Command Center" aesthetic - this is by design per memory
- Kiosk pages have their own theme objects and should remain unchanged
- White-label venue pages may need special handling if venues have custom branding colors
