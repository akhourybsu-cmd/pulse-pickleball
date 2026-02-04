
# Edit Profile Refactor - Tournament Readiness & Section Tabs

## Overview

This plan transforms the Edit Profile page from a long scrolling form into a **tabbed, section-based interface** with smart **tournament readiness indicators** that help players understand what profile information they're missing for tournament eligibility.

---

## Current State Analysis

### Existing Profile Fields (from database schema)

**Core Identity (Required)**
- `first_name` - Required
- `last_name` - Required  
- `email` - Required (from auth)
- `full_name` - Auto-generated

**Player Customization (Optional)**
- `display_name` - Leaderboard display
- `phonetic_name` - Pronunciation guide
- `avatar_url` - Profile picture
- `town` / `state` - Location

**Tournament-Critical Fields**
- `date_of_birth` - Required for age-restricted divisions
- `gender` - Required for gender-specific divisions
- `phone_number` - Required for tournament communications
- `shirt_size` - Required for merchandise
- `emergency_contact_name` - Required by some tournaments
- `emergency_contact_phone` - Required by some tournaments
- `skill_level_self` - Self-assessment for matchmaking

**Gameplay Preferences**
- `home_court_id` - Home court selection
- `handedness` - Right/Left/Ambidextrous
- `play_side` - Forehand/Backhand/Either
- `paddle_brand` / `paddle_model` - Equipment

**System Fields**
- `current_rating` - PULSE rating (system-managed)
- `total_matches` / `wins` / `losses` - Stats (system-managed)
- `dupr_rating` - External rating (not currently editable)

**Notification Preferences**
- `notify_score_email` / `notify_score_sms` / `notify_score_push`
- `notify_badges_email` / `notify_badges_sms` / `notify_badges_push`
- `notify_weekly_digest`

**Accessibility & Privacy**
- `accessibility_needs` - ADA accommodations
- `pronouns` - Personal pronouns
- `partner_preferences` - Partner matching preferences
- `location_public` - Location visibility toggle

---

## Proposed Section Structure

### Tab 1: Profile Basics
Core identity and how you appear to others
- Profile picture upload
- First name, Last name (required)
- Display name
- Phonetic name
- Pronouns
- Location (City, State)

### Tab 2: Tournament Info
Information needed for tournament registration
- Date of birth (with age calculation display)
- Gender
- Phone number
- Shirt size
- Emergency contact name & phone
- Self-assessed skill level
- Accessibility needs

### Tab 3: Play Style
Gameplay preferences and equipment
- Home court selection
- Handedness
- Play side preference
- Paddle brand & model
- Partner preferences

### Tab 4: Notifications
Communication preferences
- Score confirmation (Email/SMS/Push)
- Badge unlocks (Email/SMS/Push)
- Weekly digest
- Privacy: Location visibility toggle

### Tab 5: Security
Account security management
- Password reset
- MFA management
- Biometric setup
- Data export (GDPR)

---

## Tournament Readiness Feature

### Concept
A visual indicator showing profile completeness for tournament eligibility, displayed:
1. **In the Edit Profile header** - Overall completeness percentage
2. **On the Tournament Info tab** - Detailed breakdown
3. **During tournament registration** - Warning if missing required fields

### Tournament Readiness Checklist
Based on `tournament_event_settings` requirements:

```text
Required by ALL tournaments:
  First & Last Name
  Phone Number

Required by SOME tournaments (event_settings flags):
  Date of Birth (require_emergency_contact or age-restricted divisions)
  Gender (gender-specific divisions)
  Emergency Contact (require_emergency_contact = true)
  Full Address (require_full_address = true)

Recommended for better experience:
  Profile Picture
  Shirt Size
  Self-Assessed Skill Level
```

### Visual Design
```text
Tournament Ready ████████░░ 80%

 First & Last Name
 Phone Number
 Date of Birth
✗ Gender (Add to register for Women's divisions)
 Emergency Contact
✗ Address (Some tournaments require this)
```

---

## Implementation Details

### New Files to Create

**1. `src/lib/profileCompleteness.ts`**
Utility functions for calculating profile completeness

```typescript
interface ProfileCompletenessResult {
  overallPercentage: number;
  tournamentReady: boolean;
  missingRequired: string[];
  missingRecommended: string[];
  sections: {
    basics: { complete: number; total: number };
    tournament: { complete: number; total: number };
    playStyle: { complete: number; total: number };
  };
}

export function calculateProfileCompleteness(profile: Profile): ProfileCompletenessResult;
export function getTournamentRequirements(eventSettings?: TournamentEventSettings): string[];
export function checkTournamentReadiness(profile: Profile, requirements: string[]): {ready: boolean; missing: string[]};
```

**2. `src/components/profile/TournamentReadinessCard.tsx`**
Visual component showing tournament readiness status

**3. `src/components/profile/ProfileSectionTabs.tsx`**
Wrapper component managing the tabbed interface

### Files to Modify

**1. `src/pages/EditProfile.tsx`** - Major refactor
- Replace scrolling card layout with Tabs component
- Add tournament readiness indicator in header
- Group existing fields into tab sections
- Add progress indicators per section
- Add "missing field" highlighting

**2. `src/pages/TournamentRegister.tsx`** - Add readiness check
- Before showing form, check profile completeness
- Show warning banner if missing required tournament info
- Link to Edit Profile with focus parameter for missing fields

---

## UI/UX Improvements

### Tab Navigation
Using existing Tabs component pattern:
```tsx
<Tabs defaultValue="basics" className="w-full">
  <TabsList className="grid w-full grid-cols-5 mb-6">
    <TabsTrigger value="basics">
      <User className="h-4 w-4 mr-2" />
      <span className="hidden sm:inline">Basics</span>
    </TabsTrigger>
    <TabsTrigger value="tournament">
      <Trophy className="h-4 w-4 mr-2" />
      <span className="hidden sm:inline">Tournament</span>
      {!tournamentInfoComplete && <span className="ml-1 h-2 w-2 bg-amber-500 rounded-full" />}
    </TabsTrigger>
    <!-- ... more tabs ... -->
  </TabsList>
  
  <TabsContent value="basics">
    <!-- Profile Basics form fields -->
  </TabsContent>
  <!-- ... more content ... -->
</Tabs>
```

### Section Progress Indicators
Each tab shows completion status with a dot indicator:
-  Green dot = section complete
-  Amber dot = section has missing recommended fields
-  Red dot = section has missing required fields

### Mobile Responsiveness
- On mobile: Icon-only tabs with full labels below
- Swipe between sections supported via tabs
- Sticky save button at bottom

### Field Highlighting
Missing required fields get visual treatment:
```tsx
<div className={cn(
  "space-y-2",
  !formData.date_of_birth && highlightMissing && "ring-2 ring-amber-500/50 rounded-lg p-2"
)}>
  <Label>Date of Birth</Label>
  <Input type="date" ... />
  {!formData.date_of_birth && (
    <p className="text-xs text-amber-600">Required for age-restricted divisions</p>
  )}
</div>
```

---

## Tournament Registration Integration

### Pre-Registration Check
When a user navigates to `/tournament/:eventId/register`:

1. Fetch `tournament_event_settings` for the event
2. Check player profile against requirements
3. If missing required fields, show warning:

```tsx
<Alert variant="warning" className="mb-6">
  <AlertTriangle className="h-4 w-4" />
  <AlertDescription>
    <p className="font-medium">Complete your profile to register</p>
    <p className="text-sm mt-1">This tournament requires: Date of Birth, Emergency Contact</p>
    <Button size="sm" variant="outline" className="mt-2" asChild>
      <Link to={`/profile/edit?focus=tournament&return=/tournament/${eventId}/register`}>
        Complete Profile
      </Link>
    </Button>
  </AlertDescription>
</Alert>
```

### Return Flow
After completing profile, return user to registration:
- Store return URL in query param
- After save, redirect back to registration page

---

## Technical Details

### State Management
The existing `formData` state pattern is maintained, but organized into sections:

```typescript
// Existing state works as-is
const [formData, setFormData] = useState<ProfileData>({...});

// Add section validation helpers
const basicsSectionComplete = useMemo(() => {
  return !!(formData.first_name && formData.last_name);
}, [formData]);

const tournamentSectionComplete = useMemo(() => {
  return !!(
    formData.phone_number &&
    formData.date_of_birth &&
    formData.gender &&
    formData.emergency_contact_name &&
    formData.emergency_contact_phone
  );
}, [formData]);
```

### Save Behavior
- Save button remains at bottom (outside tabs)
- All sections save together (single API call)
- Validation runs across all sections before save

### URL Query Parameters
Support for deep-linking to specific sections:
- `/profile/edit?focus=tournament` - Opens Tournament tab
- `/profile/edit?focus=location` - Opens Basics tab, scrolls to location (existing)
- `/profile/edit?return=/tournament/123/register` - Sets return destination after save

---

## Files Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/profileCompleteness.ts` | Create | Profile completeness calculation utilities |
| `src/components/profile/TournamentReadinessCard.tsx` | Create | Visual tournament readiness indicator |
| `src/components/profile/ProfileSectionTabs.tsx` | Create | Tab wrapper component |
| `src/pages/EditProfile.tsx` | Refactor | Convert to tabbed interface |
| `src/pages/TournamentRegister.tsx` | Modify | Add profile completeness check |

---

## Expected Outcomes

1. **Better UX** - Organized sections instead of endless scrolling
2. **Tournament Awareness** - Players know exactly what's needed for tournaments
3. **Guided Completion** - Visual indicators guide users to complete their profile
4. **Reduced Registration Friction** - Pre-check prevents failed registrations
5. **Mobile-Friendly** - Tabbed interface works better on small screens
6. **Extensible** - Easy to add new fields or sections in the future
