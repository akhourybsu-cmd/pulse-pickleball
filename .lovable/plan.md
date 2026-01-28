

## Venue Ownership Verification & Admin Handover System

### Overview

This plan implements a comprehensive venue verification system that requires Pulse admin approval before a venue can be fully activated. This ensures legitimate venue ownership and creates a clear workflow for onboarding new venue partners.

---

### Current State Analysis

**Existing Infrastructure:**
- `venue_inquiries` table tracks interest submissions with `status` field (pending, converted, info_requested)
- `venues` table has `activation_state` enum: `claimed`, `pending`, `active`, `suspended`
- `user_roles` table exists with `app_role` enum: `admin`, `user`
- Admin dashboard exists at `/admin` with existing admin verification via `user_roles`
- `CreateVenueFast` creates venues with `is_published: false` but no verification gate

**Current Flow (No Verification):**
1. User completes VenueInterestWizard → Inquiry saved
2. User clicks "Create Now" → Redirected to CreateVenueFast
3. Venue created immediately with `owner_id` set → User has full access

**Problem:** No verification that the person claiming the venue actually owns it.

---

### Proposed Verification Flow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VENUE ONBOARDING FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   1. User completes VenueInterestWizard                                     │
│      └─> Inquiry created (status: "pending")                                │
│                                                                             │
│   2. Confirmation Step - TWO OPTIONS:                                       │
│      ├─> "Request More Info" → Thank you, we'll contact you                 │
│      └─> "Create Free Profile" → Creates venue with:                        │
│           • activation_state: "pending_verification"                        │
│           • verification_requested_at: timestamp                            │
│           • User sees "Verification Pending" status                         │
│                                                                             │
│   3. Pulse Admin reviews in Admin Dashboard:                                │
│      └─> New "Venue Verification" section shows pending venues              │
│           • View venue details, contact info                                │
│           • Verify ownership (call/email venue)                             │
│           • Click "Approve" → Sets activation_state: "active"               │
│                                                                             │
│   4. Venue owner receives notification → Full access granted                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Database Changes

#### 1. Update venue_activation_state Enum

Add a new state for venues awaiting verification:

```sql
-- Add new activation state for unverified venues
ALTER TYPE venue_activation_state ADD VALUE IF NOT EXISTS 'pending_verification' BEFORE 'pending';
```

**New State Order:**
- `claimed` → User started but didn't complete
- `pending_verification` → **NEW** - Awaiting admin verification
- `pending` → Verified, completing onboarding
- `active` → Fully active venue
- `suspended` → Disabled by admin

#### 2. Add Verification Tracking Columns to venues Table

```sql
ALTER TABLE venues ADD COLUMN IF NOT EXISTS verification_requested_at timestamptz;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS verification_approved_at timestamptz;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS verification_approved_by uuid REFERENCES auth.users(id);
ALTER TABLE venues ADD COLUMN IF NOT EXISTS verification_notes text;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS has_player_profile boolean DEFAULT true;
```

**Column Purposes:**
- `verification_requested_at` - When user submitted for verification
- `verification_approved_at` - When admin approved
- `verification_approved_by` - Which admin approved
- `verification_notes` - Admin notes about verification
- `has_player_profile` - Whether venue owner wants player features (addresses "venue without player account" requirement)

#### 3. Link Venue to Inquiry

The `venue_inquiries.converted_venue_id` already exists for this purpose.

---

### Frontend Changes

#### Phase 1: Update Venue Creation Flow

**File: `src/pages/venue/CreateVenueFast.tsx`**

1. Change venue creation to set `activation_state: 'pending_verification'`
2. Add `verification_requested_at: new Date().toISOString()`
3. After creation, redirect to new "Verification Pending" page instead of onboarding

**File: `src/components/venue-interest/steps/ConfirmationStep.tsx`**

Update copy to set expectations:
- Current: "Create My Free Profile and Tour Pulse Today"
- New: "Create My Free Profile — A Pulse representative will verify your venue and help you get set up"

#### Phase 2: Create Verification Pending Page

**New File: `src/pages/venue/VenueVerificationPending.tsx`**

A friendly holding page for venue owners awaiting verification:
- Shows venue name and submitted details
- Explains the verification process
- Provides expected timeline (24-48 hours)
- Allows editing contact info if needed
- Shows status badge: "Awaiting Verification"

#### Phase 3: Update VenueGuard

**File: `src/components/guards/VenueGuard.tsx`**

Add handling for `pending_verification` state:
- If `activation_state === 'pending_verification'`, redirect to verification pending page
- Only allow access to venue dashboard when `activation_state >= 'pending'`

#### Phase 4: Admin Venue Verification Dashboard

**New File: `src/pages/AdminVenueVerification.tsx`**

New admin page for managing venue verifications:
- List of venues with `activation_state = 'pending_verification'`
- For each venue, show:
  - Venue name, location, contact info
  - Linked inquiry details (goals, timeline, etc.)
  - Owner's profile info
  - Website/social links for verification
- Action buttons:
  - **Approve** → Sets `activation_state: 'pending'`, sends notification
  - **Request More Info** → Flags for follow-up
  - **Reject** → Sets `activation_state: 'suspended'` with reason

**File: `src/pages/AdminDashboard.tsx`**

Add new card linking to Venue Verification page:
```typescript
{
  icon: Building2,
  title: "Venue Verification",
  description: "Review and approve pending venue ownership claims",
  path: "/admin/venue-verification"
}
```

#### Phase 5: Player Profile Toggle

**File: `src/pages/venue/CreateVenueFast.tsx`** or **New Step**

Add option during venue creation:
- "Do you want a player profile on Pulse?" (checkbox, default: yes)
- If no: `has_player_profile: false`
- This affects whether they appear in player search, have ratings, etc.

---

### Notification System

#### Admin Notification (New Inquiry)

Enhance existing `notify-venue-inquiry` edge function:
- Already notifies on "create_now" intent
- Add prominent "VERIFY THIS VENUE" CTA

#### Venue Owner Notification (Approved)

**New Edge Function: `notify-venue-approved`**

Triggered when admin approves a venue:
- Email to venue owner
- Subject: "Your venue has been verified on Pulse!"
- Content: Welcome message, next steps, link to complete onboarding

---

### Technical Implementation Details

#### Updated State Machine

```text
                    ┌──────────────────┐
                    │                  │
     Create ──────> │ pending_         │
                    │ verification     │
                    │                  │
                    └────────┬─────────┘
                             │
                    Admin Approves
                             │
                             ▼
                    ┌────────────────┐
                    │                │
                    │    pending     │──────> Complete Onboarding
                    │                │
                    └────────┬───────┘
                             │
                    Onboarding Complete
                             │
                             ▼
                    ┌────────────────┐
                    │                │
                    │    active      │
                    │                │
                    └────────────────┘
```

#### RLS Policy Updates

Ensure venue owners can view their own venue even in `pending_verification` state:

```sql
-- Venue owners can always see their own venues
CREATE POLICY "Venue owners can view own venues"
ON venues FOR SELECT
TO authenticated
USING (owner_id = auth.uid());
```

---

### Files to Create

| File | Purpose |
|------|---------|
| `src/pages/venue/VenueVerificationPending.tsx` | Holding page while awaiting verification |
| `src/pages/AdminVenueVerification.tsx` | Admin dashboard for reviewing venues |
| `supabase/functions/notify-venue-approved/index.ts` | Email notification on approval |

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/venue/CreateVenueFast.tsx` | Set `pending_verification` state, add player profile toggle |
| `src/components/venue-interest/steps/ConfirmationStep.tsx` | Update copy to set verification expectations |
| `src/components/guards/VenueGuard.tsx` | Handle `pending_verification` state routing |
| `src/pages/AdminDashboard.tsx` | Add Venue Verification card |
| `src/App.tsx` | Add routes for new pages |
| `src/contexts/ModeContext.tsx` | Handle `pending_verification` in venue access |

---

### User Experience Summary

**For Venue Owners:**
1. Complete interest wizard → Choose "Create Free Profile"
2. Fill in basic venue info → See "Thanks! Your venue is being verified"
3. Receive email when approved → Complete onboarding → Go live

**For Pulse Admins:**
1. Receive notification of new venue claim
2. Open Admin Dashboard → Venue Verification
3. Review details, verify ownership (call/check website)
4. Click Approve → Owner is notified, can proceed

**For Venues Without Player Profiles:**
- During setup, uncheck "Create player profile"
- Venue functions normally
- Owner doesn't appear in player search or leaderboards

---

### Security Considerations

1. **Admin Verification Required** - No venue can go "active" without admin approval
2. **Audit Trail** - `verification_approved_by` and timestamps track who approved what
3. **Role-Based Access** - Only users with `admin` role can access verification dashboard
4. **RLS Policies** - Venues in `pending_verification` are only visible to owner and admins

