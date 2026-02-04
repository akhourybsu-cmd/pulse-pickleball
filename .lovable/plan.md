

# Venue Platform Comprehensive Analysis & Integration Audit

## Executive Summary

After an extensive review of the Venue admin platform, I've analyzed **20+ venue pages**, **15+ hooks**, and **25+ components**. Overall, the platform is **well-architected** with proper data flow and consistent patterns. However, I've identified several areas requiring attention to ensure everything hooks up properly.

---

## Current Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              VENUE PLATFORM                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────┐     ┌─────────────────────┐                       │
│  │   VenueShell.tsx    │────►│   ModeContext.tsx   │                       │
│  │  (Layout + Nav)     │     │  (Auth + Access)    │                       │
│  └─────────────────────┘     └─────────────────────┘                       │
│           │                           │                                     │
│           ▼                           ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                         ADMIN PAGES                               │       │
│  ├────────────┬────────────┬────────────┬────────────┬─────────────┤       │
│  │ Overview   │ Profile    │ Branding   │ Facility   │ Media       │       │
│  │ Analytics  │ Courts     │ Bookings   │ Events     │ Tournaments │       │
│  │ RoundRobins│ Coaching   │ Staff      │ Settings   │             │       │
│  └────────────┴────────────┴────────────┴────────────┴─────────────┘       │
│           │                                                                 │
│           ▼                                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                       DATA HOOKS                                  │       │
│  ├────────────┬────────────┬────────────┬────────────┬─────────────┤       │
│  │ useVenue-  │ useVenue-  │ useVenue-  │ useVenue-  │ useVenue-   │       │
│  │ Settings   │ Events     │ Courts     │ Bookings   │ Staff       │       │
│  │ useVenue-  │ useVenue-  │ useVenue-  │ usePublic- │ usePublish- │       │
│  │ Coaches    │ Tournaments│ RoundRobins│ Venue      │ Readiness   │       │
│  └────────────┴────────────┴────────────┴────────────┴─────────────┘       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PUBLIC VENUE PAGES                                 │
│                          /v/:slug | /venue/:slug                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  PublicVenueShell                                                           │
│  ├── Home Tab      (hero, quick actions, featured events)                   │
│  ├── Schedule Tab  (court availability, time slots, bookings)               │
│  ├── Events Tab    (filterable event list, registration)                    │
│  ├── Coaching Tab  (coach profiles, lesson booking)                         │
│  └── Info Tab      (hours, amenities, location)                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Findings Summary

### Properly Connected Features

| Feature | Admin Page | Hook | Public Page | Status |
|---------|------------|------|-------------|--------|
| Events | VenueEvents.tsx | useVenueEvents | PublicEventsTab | Working |
| Coaching | VenueCoaching.tsx | useVenueCoaches | PublicCoachingTab | Working |
| Courts | VenueCourts.tsx | useVenueCourts | PublicScheduleTab | Working |
| Bookings | VenueBookings.tsx | useVenueBookings | BookingFlowDialog | Working |
| Staff | VenueStaff.tsx | useVenueStaff | N/A (Admin only) | Working |
| Tournaments | VenueTournaments.tsx | useVenueTournaments | Links to /tournaments/:id | Working |
| Round Robins | VenueRoundRobins.tsx | useVenueRoundRobins | Links to /venue/round-robins/:id | Working |
| Analytics | VenueAnalytics.tsx | Combined hooks | N/A (Admin only) | Working |
| Settings | VenueSettings.tsx | useVenueSettings | Applied to public page | Working |
| Profile | VenueProfile.tsx | useVenueSettings | PublicInfoTab | Working |
| Branding | VenueBranding.tsx | useVenueSettings | All venue pages | Working |
| Facility | VenueFacility.tsx | useVenueFacility | PublicInfoTab | Working |
| Media | VenueMedia.tsx | useVenueMedia | PublicHomeTab | Working |

### Issues Identified

#### Issue 1: Two Separate Event Registration Tables
**Severity:** Medium - Data Fragmentation Risk

**Problem:** There are two different event registration systems:
- `venue_event_registrations` - Used by `EventRegistrationsDialog.tsx` (venue admin view)
- `event_registrations` - Used by `useEventRegistrations.ts` (tournament/general events)

**Impact:** Event registrations may not be synchronized between the two systems. The `venue_events` table stores events, but registrations could end up in either table depending on the registration flow used.

**Recommendation:** Audit and consolidate event registration flows to ensure a single source of truth, or implement cross-table synchronization.

---

#### Issue 2: Round Robin Event Linking
**Severity:** Low - Already Handled

**Status:** The code properly handles round robin creation:
- When creating a "round_robin" type event via `CreateEventDialog`, it:
  1. Creates entry in `venue_events`
  2. Creates linked entry in `round_robin_events`
  3. Links them via `round_robin_event_id` column

The flow is correct and the "Manage Round Robin" button properly navigates to `/venue/round-robins/:id`.

---

#### Issue 3: Missing Prefetch Routes
**Severity:** Low - Performance Optimization

**Problem:** In `VenueShell.tsx`, the prefetch map is incomplete:
```typescript
const prefetchMap: Record<string, () => Promise<unknown>> = {
  '/venue': () => import('@/pages/venue/VenueOverview'),
  '/venue/courts': () => import('@/pages/venue/VenueCourts'),
  // Missing: /venue/profile, /venue/branding, /venue/facility, /venue/media, 
  //          /venue/staff, /venue/round-robins
};
```

**Recommendation:** Add missing routes to prefetch map for faster navigation.

---

#### Issue 4: VenueGuard Activation States
**Severity:** Low - Currently Working

**Status:** The `VenueGuard` component properly handles venue activation states:
- `claimed` → redirects to onboarding/profile
- `pending_verification` → redirects to verification-pending
- `pending` → redirects to onboarding/first-event
- `active` → allows access

The onboarding flow is complete with 4 steps:
1. VenueOnboardingProfile
2. VenueOnboardingFirstEvent
3. VenueOnboardingShare
4. VenueOnboardingComplete

---

#### Issue 5: Public Page Deep Linking
**Severity:** Low - Already Working

**Status:** The `PublicVenueLanding.tsx` properly handles:
- `?tab=schedule|events|coaching|info` - Tab navigation
- `?eventId=xxx` - Scrolls to and highlights specific event
- `?coachId=xxx` - Scrolls to and highlights specific coach

---

#### Issue 6: RLS Policies - Security Warnings
**Severity:** Medium - Review Recommended

**Problem:** Database linter found 18 warnings including:
- Multiple "RLS Policy Always True" warnings (UPDATE/INSERT with `true`)
- Security definer view detected
- Functions missing search_path

**Recommendation:** Review and tighten RLS policies for:
- Venue admin operations (ensure only staff can modify)
- Event registrations (ensure proper access control)

---

## Feature-by-Feature Integration Analysis

### Events System

**Admin Flow (Working):**
```
VenueEvents.tsx
    └── useVenueEvents(venueId)
        └── createEvent() → venue_events table
            └── If round_robin type → creates round_robin_events entry
    └── CreateEventDialog → form for new events
    └── EventCard → displays event with actions
        └── EventRegistrationsDialog → shows registrations from venue_event_registrations
        └── EditEventDialog → updates event
```

**Public Flow (Working):**
```
PublicVenueLanding.tsx
    └── usePublicVenue(slug)
        └── Fetches published events from venue_events
    └── PublicEventsTab → displays events
    └── EventRegistrationDialog → registers user
        └── Creates entry in venue_event_registrations
```

### Coaching System

**Admin Flow (Working):**
```
VenueCoaching.tsx
    └── useVenueCoaches(venueId)
        └── createCoach() → venue_coaches table
    └── CreateCoachDialog → form for new coach
    └── CoachCard → displays coach with toggle active/delete
```

**Public Flow (Working):**
```
PublicVenueLanding.tsx
    └── usePublicVenue(slug)
        └── Fetches active coaches from venue_coaches
    └── PublicCoachingTab → displays coaches
    └── CoachLessonBookingDialog → books lesson
```

### Bookings System

**Admin Flow (Working):**
```
VenueBookings.tsx
    └── useVenueBookings(venueId)
    └── useVenueCourts(venueId) → needed for court selection
    └── CreateBookingDialog → creates manual booking
    └── BookingCard → shows booking with status management
```

**Public Flow (Working):**
```
PublicVenueLanding.tsx
    └── PublicScheduleTab
        └── useVenueAvailability() → checks available slots
        └── BookingFlowDialog → multi-step booking process
```

### Tournament Integration

**Admin Flow (Working):**
```
VenueTournaments.tsx
    └── useVenueTournaments(venueId)
        └── Fetches from tournaments_events WHERE venue_id = X
    └── "Create Tournament" → navigates to /tournaments/new?venueId=xxx
    └── TournamentCard → "View" navigates to /tournaments/:id
```

**Connection to Global Tournament System:** The venue tournament page correctly uses the shared `tournaments_events` table with venue_id filtering, ensuring tournaments appear in both the venue admin and the global tournament discovery.

### Round Robin Integration

**Admin Flow (Working):**
```
VenueRoundRobins.tsx
    └── useVenueRoundRobins()
        └── Fetches from round_robin_events WHERE venue_id = X
    └── EventCard with round_robin type → "Manage Round Robin" button
    └── VenueRoundRobinDetail → full round robin management
    └── VenueRoundRobinKiosk → public display for live events
```

**Creation Flow:** Round robins can be created two ways:
1. Via VenueEvents → CreateEventDialog with type "round_robin"
2. Redirected from VenueRoundRobins empty state → VenueEvents

---

## Venue Profile/Settings Overlap

**Current State:** There are THREE pages that edit venue data:
1. **VenueProfile.tsx** - Identity, description, contact, social
2. **VenueBranding.tsx** - Logo, cover image, colors
3. **VenueSettings.tsx** - Basic info, location, branding, subscription, Stripe

**Analysis:** All three use `useVenueSettings` hook which updates the `venues` table. The forms overlap somewhat but serve different purposes:
- Profile = How you present yourself
- Branding = Visual identity
- Settings = Technical/operational configuration

**Recommendation:** Consider consolidating or more clearly differentiating these pages. Currently, some fields appear in multiple places (e.g., tagline is in both Profile and Settings).

---

## Public Venue Page Integration

The public venue pages correctly fetch and display:

| Admin Created | Public Display |
|---------------|----------------|
| Venue Profile | Info Tab, Header |
| Branding Colors | Throughout (buttons, accents) |
| Logo | Header, Home Tab |
| Cover Image | Home Tab hero |
| Courts | Schedule Tab (availability) |
| Events (published) | Events Tab |
| Coaches (active) | Coaching Tab |
| Facility Details | Info Tab (amenities) |
| Hours of Operation | Schedule Tab (availability filtering) |

---

## Recommended Fixes

### Fix 1: Add Missing Prefetch Routes
**Location:** `src/components/layout/VenueShell.tsx`

Add to prefetchMap:
- `/venue/profile` → VenueProfile
- `/venue/branding` → VenueBranding
- `/venue/facility` → VenueFacility
- `/venue/media` → VenueMedia
- `/venue/staff` → VenueStaff
- `/venue/round-robins` → VenueRoundRobins

### Fix 2: Event Registration Table Audit
**Action Required:** 
1. Determine if `venue_event_registrations` and `event_registrations` should be unified
2. If separate, ensure proper usage:
   - `venue_event_registrations` for venue-specific events (socials, clinics)
   - `event_registrations` for tournaments only

### Fix 3: Add Error Boundaries to Venue Pages
**Location:** Consider adding error boundaries around venue pages to gracefully handle:
- Missing venue data
- RLS policy violations
- Network errors

### Fix 4: Review RLS Policies
**Action Required:** Security review of database policies for:
- `venue_events` (ensure only staff can create/update)
- `venue_event_registrations` (ensure proper player access)
- `venue_coaches` (ensure only staff can manage)
- `venue_bookings` (ensure proper access for both venue staff and booking customer)

---

## Conclusion

The Venue platform is **well-integrated** with proper data flow between admin and public pages. The main areas requiring attention are:

1. **Event registration table fragmentation** - Needs consolidation or clear separation
2. **RLS policy review** - Security warnings should be addressed
3. **Minor optimizations** - Prefetch routes, error boundaries

Overall Status: **Operational** with recommended improvements.

