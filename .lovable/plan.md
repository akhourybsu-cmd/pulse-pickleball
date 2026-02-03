

# Tournament System Comprehensive Settings Overhaul

## Executive Summary

Based on analysis of the current PULSE tournament system and best practices from pickleballtournaments.com and USA Pickleball standards, this plan outlines the missing settings, configurations, and front-end integrations needed to create a fully functional, professional-grade tournament management system.

---

## Current State Analysis

### What Exists

| Category | Current Implementation |
|----------|------------------------|
| **Event Settings** | Basic fields: name, dates, location, description, registration dates, fees, waitlist |
| **Divisions** | Name, format (round_robin only), max_teams, scoring_ruleset |
| **Registration** | 4-step wizard: division, team info, additional info, review |
| **Customization** | Hero images, about markdown, venue details, policies, sponsors, contact info |
| **Operations** | Check-in dashboard, court assignment, score entry, bracket view |

### Critical Gaps Identified

| Gap Category | Missing Features | Priority |
|--------------|------------------|----------|
| **Division Configuration** | Skill levels, age groups, gender, play type (singles/doubles/mixed) | High |
| **Advanced Formats** | Single/double elimination, pool play, hybrid formats | High |
| **Registration Settings** | Partner requirements, max events per player, early bird pricing | High |
| **Scheduling** | Match duration estimates, time slots, court allocation | High |
| **Player Score Entry** | Self-reporting, auto-confirm timers | Medium |
| **Seeding** | Manual seeding, rating-based seeding | Medium |
| **Communication** | SMS/email templates, automated notifications | Medium |
| **Check-in** | Match-ready status vs tournament check-in | Low |

---

## Implementation Plan

### Phase 1: Division Settings Enhancement (Database + UI)

#### 1A. New Database Columns for `tournaments_divisions`

Add comprehensive division configuration fields:

```sql
-- New columns for tournaments_divisions table
skill_level_min DECIMAL(3,2)       -- e.g., 3.0, 3.5, 4.0
skill_level_max DECIMAL(3,2)       -- e.g., 3.5, 4.0, 4.5
age_group TEXT                      -- 'junior', 'adult', 'senior'
age_min INTEGER                     -- e.g., 50, 60, 70
age_max INTEGER                     -- e.g., NULL for no upper limit
gender TEXT                         -- 'men', 'women', 'mixed', 'open'
play_type TEXT                      -- 'singles', 'doubles', 'mixed_doubles'
registration_fee DECIMAL(10,2)      -- Division-specific fee (overrides event fee)
early_bird_fee DECIMAL(10,2)        -- Discounted early registration
early_bird_deadline TIMESTAMPTZ     -- When early bird expires
estimated_match_duration INTEGER    -- Minutes per match for scheduling
min_teams INTEGER                   -- Minimum teams to run division
scheduled_start_time TIME           -- When this division starts
scheduled_day INTEGER               -- Day 1, 2, etc. for multi-day
```

#### 1B. New `tournament_event_settings` Table

Create dedicated settings table for advanced event configuration:

```sql
CREATE TABLE tournament_event_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES tournaments_events(id) ON DELETE CASCADE,
  
  -- Registration Controls
  max_events_per_player INTEGER DEFAULT 3,
  max_events_per_day INTEGER,
  require_partner_account BOOLEAN DEFAULT false,
  require_emergency_contact BOOLEAN DEFAULT true,
  require_full_address BOOLEAN DEFAULT false,
  allow_same_format_multiple BOOLEAN DEFAULT false,
  
  -- Player Score Entry
  allow_player_score_entry BOOLEAN DEFAULT false,
  score_auto_confirm_minutes INTEGER DEFAULT 3,
  
  -- Check-in Settings
  check_in_window_hours INTEGER DEFAULT 1,
  require_match_ready_confirm BOOLEAN DEFAULT false,
  
  -- Scheduling
  default_match_duration INTEGER DEFAULT 30,
  court_transition_minutes INTEGER DEFAULT 5,
  
  -- Communication
  auto_email_on_register BOOLEAN DEFAULT true,
  auto_email_on_payment BOOLEAN DEFAULT true,
  auto_email_court_assignment BOOLEAN DEFAULT false,
  sms_enabled BOOLEAN DEFAULT false,
  
  -- Age Determination
  age_determination_date DATE,  -- Default: Dec 31 of tournament year
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 1C. Update `CreateDivisionDialog.tsx` and `EditDivisionDialog.tsx`

Add new form fields for:
- Skill level range selector (3.0 - 5.0+)
- Age group selector with age brackets
- Gender/play type selector
- Division-specific pricing with early bird option
- Estimated match duration
- Minimum teams to run
- Scheduling preferences (day/time)

---

### Phase 2: Event Settings Expansion (UI Components)

#### 2A. Create `TournamentSettingsPage.tsx`

New dedicated settings page with organized tabs:

```
Tabs:
├── General (existing fields: dates, location)
├── Registration (new: max events, partner requirements)
├── Divisions (quick overview of all divisions)
├── Scheduling (match durations, court allocation)
├── Communication (email/SMS settings)
├── Advanced (player score entry, age determination)
```

#### 2B. Update `EditTournamentDialog.tsx`

Add missing settings:
- Max events per player/day
- Partner account requirement toggle
- Emergency contact required toggle
- Age determination date picker

---

### Phase 3: Division Card System Enhancement

#### 3A. Create `DivisionCardAdvanced.tsx`

Display division info with:
- Skill level badge (e.g., "3.5 - 4.0")
- Age group badge (e.g., "50+", "19+")
- Gender/format indicator
- Registration count with progress bar
- Early bird pricing countdown
- "Division Filling Fast" warning at 75%

#### 3B. Update `TournamentDivisionsGrid.tsx`

- Show all new division attributes
- Filter/sort by skill level, age, gender
- Display pricing tiers (early bird vs regular)

---

### Phase 4: Registration Flow Enhancement

#### 4A. Update Registration Steps

**Step 1 - Division Selection Enhancement:**
- Filter divisions by skill level compatibility
- Show age eligibility warnings
- Display partner requirements
- Show early bird savings

**Step 2 - Team Info Enhancement:**
- Partner search with account requirement option
- Partner skill level validation
- Multiple event selection for same player

**Step 3 - Additional Info Enhancement:**
- Dynamic fields based on event settings
- Address collection if required
- Multiple emergency contacts

**Step 4 - Review Enhancement:**
- Total fee breakdown (base + per-division)
- Early bird discount display
- Policy acceptance with timestamp

#### 4B. Create Registration Validation Logic

```typescript
// New validation functions
validateSkillLevel(playerRating, divisionMin, divisionMax)
validateAgeEligibility(playerDOB, divisionAgeMin, divisionAgeMax, ageDate)
validateEventLimits(playerId, eventId, maxEvents)
validatePartnerRequirements(partnerId, requireAccount)
```

---

### Phase 5: Scheduling & Court Management

#### 5A. Create `TournamentScheduler.tsx`

New scheduling interface with:
- Day planner with estimated duration
- Court allocation matrix
- Division time slot assignment
- Conflict detection
- Capacity simulator

#### 5B. Update Match Duration Estimates

```typescript
const MATCH_DURATION_ESTIMATES = {
  games_to_11: 20,      // minutes
  games_to_15: 30,
  games_to_21: 45,
  best_of_3_to_11: 45,
  best_of_3_to_15: 60,
};
```

---

### Phase 6: Player Score Entry System

#### 6A. Create `PlayerScoreEntry.tsx`

Mobile-optimized score entry:
- Winner submits score
- Opponent confirms/disputes
- Auto-confirm timer display
- Dispute resolution flow

#### 6B. Create `ScoreConfirmationDialog.tsx`

- Score display with team names
- Confirm/Dispute buttons
- Timer countdown
- Dispute reason input

#### 6C. Update Match Progression Logic

```typescript
// Auto-confirm logic
if (score_submitted && !opponent_response && time_elapsed > auto_confirm_minutes) {
  confirmScore();
  advanceBracket();
  notifyNextMatch();
}
```

---

### Phase 7: Communication Templates

#### 7A. Create `TournamentEmailTemplates.tsx`

Customizable templates for:
- Registration confirmation
- Payment confirmation
- Check-in reminder (24h, 1h before)
- Court assignment notification
- Match ready notification
- Results confirmation

#### 7B. Update Edge Functions

Enhance existing functions:
- `send-registration-confirmation`: Add event settings data
- `send-tournament-reminders`: Add court/time info
- Create `send-court-assignment`: New function for match notifications

---

### Phase 8: Seeding System

#### 8A. Create `SeedingManager.tsx`

- Manual drag-and-drop seeding
- Auto-seed by PULSE rating
- Auto-seed by DUPR rating (if available)
- Random seeding option
- Preview bracket with seeding

#### 8B. Database Update

```sql
-- Add to tournaments_teams
seed_source TEXT  -- 'manual', 'pulse_rating', 'dupr', 'random'
seed_locked BOOLEAN DEFAULT false
```

---

### Phase 9: Front-End Integration Points

#### 9A. Tournament Landing Page Updates

Show on `TournamentLanding.tsx`:
- Skill level requirements per division
- Age brackets and eligibility
- Early bird countdown timer
- Remaining spots per division
- Partner requirements notice

#### 9B. Quick Facts Updates (`TournamentQuickFacts.tsx`)

Add new fact cards:
- Skill Level Range
- Age Groups
- Partner Required (Yes/No)
- Early Bird ends in X days

#### 9C. Division Grid Updates (`TournamentDivisionsGrid.tsx`)

Display per division:
- Skill level badge
- Age bracket badge
- Gender indicator
- Pricing (early bird vs regular)
- Fill percentage with progress bar

---

## Database Migration Summary

### New Table
- `tournament_event_settings`

### Altered Tables
| Table | New Columns |
|-------|-------------|
| `tournaments_divisions` | skill_level_min, skill_level_max, age_group, age_min, age_max, gender, play_type, registration_fee, early_bird_fee, early_bird_deadline, estimated_match_duration, min_teams, scheduled_start_time, scheduled_day |
| `tournaments_teams` | seed_source, seed_locked |
| `tournaments_matches` | player_score_submitted_by, player_score_submitted_at, opponent_confirmed, opponent_confirmed_at, auto_confirmed |

---

## New Components to Create

### Settings Components
1. `src/components/tournament/settings/TournamentSettingsPage.tsx`
2. `src/components/tournament/settings/RegistrationSettingsTab.tsx`
3. `src/components/tournament/settings/SchedulingSettingsTab.tsx`
4. `src/components/tournament/settings/CommunicationSettingsTab.tsx`
5. `src/components/tournament/settings/AdvancedSettingsTab.tsx`

### Division Components
6. `src/components/tournament/DivisionCardAdvanced.tsx`
7. `src/components/tournament/DivisionFilterBar.tsx`
8. `src/components/tournament/SkillLevelSelector.tsx`
9. `src/components/tournament/AgeGroupSelector.tsx`

### Scheduling Components
10. `src/components/tournament/scheduling/TournamentScheduler.tsx`
11. `src/components/tournament/scheduling/DayPlanner.tsx`
12. `src/components/tournament/scheduling/CourtAllocationMatrix.tsx`
13. `src/components/tournament/scheduling/CapacitySimulator.tsx`

### Score Entry Components
14. `src/components/tournament/scoring/PlayerScoreEntry.tsx`
15. `src/components/tournament/scoring/ScoreConfirmationDialog.tsx`
16. `src/components/tournament/scoring/DisputeResolutionFlow.tsx`

### Seeding Components
17. `src/components/tournament/seeding/SeedingManager.tsx`
18. `src/components/tournament/seeding/DragDropSeeding.tsx`
19. `src/components/tournament/seeding/BracketPreview.tsx`

### Communication Components
20. `src/components/tournament/communication/EmailTemplateEditor.tsx`
21. `src/components/tournament/communication/NotificationPreview.tsx`

---

## Files to Modify

### Existing Components
1. `src/components/tournament/CreateDivisionDialog.tsx` - Add all new division fields
2. `src/components/tournament/EditDivisionDialog.tsx` - Add all new division fields
3. `src/components/tournament/EditTournamentDialog.tsx` - Add event settings
4. `src/components/tournament/landing/TournamentQuickFacts.tsx` - Add skill/age facts
5. `src/components/tournament/landing/TournamentDivisionsGrid.tsx` - Show new attributes
6. `src/components/tournament/RegistrationStepDivision.tsx` - Add filtering/validation
7. `src/components/tournament/RegistrationStepTeamInfo.tsx` - Partner validation
8. `src/components/tournament/ScoreEntryDialog.tsx` - Add player entry support
9. `src/pages/TournamentRegister.tsx` - New validation logic
10. `src/pages/TournamentLanding.tsx` - Display new settings

### Edge Functions
11. `supabase/functions/send-registration-confirmation/index.ts` - Include new data
12. Create `supabase/functions/send-court-assignment/index.ts` - New function

---

## Technical Implementation Order

### Sprint 1: Foundation (Database + Core Settings)
1. Database migrations for new columns and tables
2. Create `TournamentSettingsPage.tsx` with tabs
3. Update division dialogs with new fields
4. Add validation logic

### Sprint 2: Division Management
5. Create skill level and age group selectors
6. Update division grid with filters
7. Add early bird pricing logic
8. Create capacity warnings

### Sprint 3: Registration Enhancement
9. Update registration steps with validation
10. Add partner account requirements
11. Implement event limits per player
12. Add age eligibility checks

### Sprint 4: Scheduling & Scoring
13. Create scheduler interface
14. Add player score entry
15. Implement auto-confirm logic
16. Add court assignment notifications

### Sprint 5: Seeding & Polish
17. Create seeding manager
18. Add communication templates
19. Final front-end integration
20. Testing and refinement

---

## Expected Outcomes

1. **Professional Parity**: Feature set comparable to pickleballtournaments.com
2. **USAP Compliance**: Support for official skill levels, age brackets, and formats
3. **Organizer Efficiency**: Reduced manual work with auto-scheduling and player score entry
4. **Player Experience**: Clear division eligibility, early bird incentives, real-time updates
5. **Scalability**: Settings architecture supports future feature expansion

