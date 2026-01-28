

## Comprehensive Venue Mode Cleanup & UX Enhancement Plan

### Overview
After a thorough audit of the venue side of the application, I've identified several categories of issues that need to be addressed to achieve a professional, intuitive, and consistent venue management experience.

---

### Executive Summary of Issues Found

| Category | Issue Count | Priority |
|----------|-------------|----------|
| Navigation Inconsistencies | 4 | High |
| Dead-End Pages | 2 | High |
| Mobile/Desktop UX Issues | 6 | Medium |
| Redundant/Unused Features | 3 | Low |
| Mode Switching Friction | 2 | High |
| Multi-Venue Management | 3 | Medium |

---

## Phase 1: Navigation Architecture Cleanup

### Issue 1.1: Sidebar vs Bottom Nav Mismatch

**Problem:** The desktop sidebar (`navItems`) and mobile bottom nav (`bottomNavItems`) show different items, causing confusion when switching between devices.

**Current Sidebar (10 items):**
- Overview, Profile, Branding, Facility, Media, Tournaments, Round Robins, Events, Staff, Settings

**Current Bottom Nav (5 items):**
- Overview, Courts, Tournaments, Events, Settings

**Missing from Bottom Nav:**
- Profile, Branding, Facility, Media, Round Robins, Staff
- Has "Courts" which isn't in sidebar

**Fix:**
- Redesign navigation to be consistent across both
- Create a logical hierarchy:
  - **Primary Nav (Bottom + Sidebar):** Overview, Events, Tournaments, Courts, More
  - **"More" menu opens:** Profile, Branding, Facility, Media, Staff, Settings

### Issue 1.2: Missing Routes in Navigation

**Pages Accessible but Not in Any Nav:**
- `/venue/bookings` - Only reachable via Overview card click
- `/venue/coaching` - Only reachable via App.tsx route
- `/venue/analytics` - Only reachable via Overview quick action
- `/venue/community` - In App.tsx routes but no navigation link

**Fix:**
- Add Analytics to sidebar
- Move Coaching to Events section or add to sidebar
- Add Bookings to sidebar (important operational feature)
- Remove or properly integrate Community page

### Issue 1.3: Round Robins vs Events Confusion

**Problem:** Round Robins page tells users to "create a Round Robin event from the Events tab" but users may not understand this relationship.

**Fix:**
- Add a "Create Round Robin" button directly on Round Robins page
- Clarify in Events page that Round Robins are managed separately after creation

---

## Phase 2: Dead-End & Missing Feature Cleanup

### Issue 2.1: VenueCommunity Page Dead-End

**Problem:** `/venue/community` route exists in App.tsx but has no navigation link anywhere. The page exists and works but users can't find it.

**Fix Option A:** Add to sidebar navigation under a "Community" or "Engagement" section
**Fix Option B:** Remove the route if the feature isn't ready for production

### Issue 2.2: Coaching Page Not Discoverable

**Problem:** VenueCoaching page exists at `/venue/coaching` but isn't in sidebar or bottom nav.

**Fix:** Add to sidebar navigation - this is a valuable feature for venues

### Issue 2.3: Analytics Page Hidden

**Problem:** VenueAnalytics at `/venue/analytics` is only accessible via Quick Actions on Overview

**Fix:** Add to sidebar, likely under Overview or before Settings

---

## Phase 3: Mobile/Desktop Consistency

### Issue 3.1: Cards Need Mobile Optimization

**Files to review:**
- `VenueOverview.tsx` - Metrics cards grid works but could use better mobile spacing
- `VenueCourts.tsx` - 3-column grid on desktop, should collapse to 1 on mobile
- `VenueRoundRobins.tsx` - Cards work but action buttons could be cleaner

**Fixes:**
- Ensure all grids use `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Add proper padding and spacing for mobile (currently p-6, should be responsive)

### Issue 3.2: Form Pages Need Mobile Polish

**Pages to audit:**
- `VenueProfile.tsx` - Large forms need better mobile layout
- `VenueFacility.tsx` - Switch controls work but labels could be improved
- `VenueSettings.tsx` - Long page, needs section anchors on mobile

**Fixes:**
- Add sticky save buttons on mobile
- Consider collapsible sections for long forms
- Improve touch target sizes for switches

### Issue 3.3: Header Consistency in VenueShell

**Current:** Mobile shows hamburger menu, logo, theme toggle, mode switcher
**Issue:** No notifications or user profile access from venue mode on mobile

**Fix:** Consider adding notification bell or user menu to venue header

---

## Phase 4: Mode Switching Enhancement

### Issue 4.1: ModeSwitcher UX

**Current Behavior:**
- Desktop: Dropdown menu
- Mobile: Bottom drawer

**Issues:**
- When managing multiple venues, the search only appears if you have 5+ venues
- Venue list scrolls but there's no visual indicator of more venues below
- "Add New Venue" always goes to `/venue/interest` even for logged-in users

**Fixes:**
- Show search at 3+ venues instead of 5
- Add scroll shadow/fade indicator when list overflows
- For logged-in venue owners, "Add New Venue" should go directly to `/venue/create-fast`

### Issue 4.2: Quick Switch Between Player and Venue

**Current:** Works but requires navigating away from current page

**Enhancement:**
- Remember last page per mode so switching back returns to where user was
- Add keyboard shortcut (Cmd/Ctrl+Shift+M) for power users

---

## Phase 5: Multi-Venue Management Polish

### Issue 5.1: Venue Context Indicator

**Problem:** When in venue mode, it's not always clear which venue you're managing, especially on pages that don't show the logo prominently.

**Fix:**
- Add venue name/badge to mobile header
- Consider breadcrumb showing current venue on desktop

### Issue 5.2: Venue List Order

**Current:** Venues listed in arbitrary order

**Fix:**
- Sort by most recently accessed
- Or alphabetically with current venue pinned to top

### Issue 5.3: Role Badges in Switcher

**Good:** Role badges (owner, manager, organizer, staff) already exist

**Enhancement:**
- Add subtle visual distinction for venues where user has admin vs staff role
- Consider grouping by role

---

## Phase 6: Remove/Hide Incomplete Features

### Issue 6.1: Audit Unused Pages

**Pages to evaluate:**
- `VenueCommunity.tsx` - Keep or remove? Currently orphaned
- Venue onboarding flow in `/venue/onboarding/*` - Is this still used?

**Fix:** Either properly integrate or remove from routes

### Issue 6.2: Clean Up Navigation Items

**Current navItems in VenueShell:**
```typescript
const navItems = [
  { to: '/venue', label: 'Overview' },           // Keep
  { to: '/venue/profile', label: 'Profile' },    // Keep
  { to: '/venue/branding', label: 'Branding' },  // Keep
  { to: '/venue/facility', label: 'Facility' },  // Keep
  { to: '/venue/media', label: 'Media' },        // Keep
  { to: '/venue/tournaments', label: 'Tournaments' }, // Keep
  { to: '/venue/round-robins', label: 'Round Robins' }, // Keep
  { to: '/venue/events', label: 'Events' },      // Keep
  { to: '/venue/staff', label: 'Staff' },        // Keep
  { to: '/venue/settings', label: 'Settings' },  // Keep
];
```

**Missing from sidebar:**
- Courts (available via Overview card only)
- Bookings (available via Overview card only)
- Coaching (available via route only)
- Analytics (available via Quick Actions only)
- Community (orphaned)

---

## Phase 7: Recommended Navigation Restructure

### Proposed Sidebar Navigation (Desktop)

**Reorganize into logical groups:**

```text
OVERVIEW
  Overview (dashboard)
  Analytics

VENUE SETUP
  Profile
  Branding
  Facility
  Media

OPERATIONS
  Courts
  Bookings
  Events
  Tournaments
  Round Robins
  Coaching

TEAM
  Staff

ADMIN
  Settings
```

### Proposed Bottom Navigation (Mobile)

**Keep to 5 items max with More menu:**

```text
[Overview] [Events] [Courts] [Bookings] [More]

"More" drawer opens with:
  - Tournaments
  - Round Robins
  - Coaching
  - Profile
  - Branding
  - Facility
  - Media
  - Staff
  - Analytics
  - Settings
```

---

## Implementation Priority

### High Priority (Do First)
1. Add missing pages to sidebar navigation (Courts, Bookings, Coaching, Analytics)
2. Fix bottom nav to include Courts and Bookings with proper "More" menu
3. Fix ModeSwitcher "Add New Venue" link for logged-in users
4. Address VenueCommunity orphaned page

### Medium Priority
5. Mobile form polish (sticky save buttons, section headers)
6. Multi-venue UX improvements (search threshold, scroll indicators)
7. Navigation grouping and visual hierarchy

### Low Priority
8. Keyboard shortcuts for mode switching
9. Remember last page per mode
10. Advanced role-based venue grouping

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/components/layout/VenueShell.tsx` | Add missing nav items, restructure into groups, fix bottom nav |
| `src/components/mode/ModeSwitcher.tsx` | Fix "Add New Venue" link, lower search threshold, add scroll indicator |
| `src/pages/venue/VenueRoundRobins.tsx` | Add "Create Round Robin" button |
| `src/pages/venue/VenueOverview.tsx` | Minor mobile padding adjustments |
| `src/pages/venue/VenueSettings.tsx` | Add mobile sticky save button |
| `src/pages/venue/VenueProfile.tsx` | Add mobile sticky save button |
| `src/App.tsx` | Potentially remove `/venue/community` route if orphaned |

---

## Testing Checklist

After implementation, verify:
- [ ] All venue pages are accessible from sidebar on desktop
- [ ] All venue pages are accessible from bottom nav + More menu on mobile
- [ ] Switching between venues immediately reflects correct branding
- [ ] Mode switcher works smoothly on mobile (drawer) and desktop (dropdown)
- [ ] New venue creation flow works for both logged-in and logged-out users
- [ ] Courts and Bookings pages are easily discoverable
- [ ] Analytics is accessible from navigation (not just Quick Actions)
- [ ] Forms save correctly with sticky save buttons on mobile
- [ ] No dead-end pages or orphaned routes exist

