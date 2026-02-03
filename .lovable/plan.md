

# Tournament System Review - Issues & Fine-Tuning Plan

## Executive Summary

After a comprehensive review of the tournament system, I've identified **17 critical issues** across 4 categories that need to be addressed to ensure all components work together properly. The main problems are:

1. **New components created but not integrated** into the admin UI
2. **Database schema mismatches** between components and actual tables
3. **Missing feature access control** for new tournament features
4. **Incomplete data flow** between settings and the components that use them

---

## Category A: Orphaned Components (Not Integrated)

### Issue A1: TournamentSettingsPanel Not Used

**Problem**: The `TournamentSettingsPanel` component exists but is not rendered anywhere. The "Settings" tab in `TournamentEventDetail.tsx` shows legacy manual fields instead of using the new comprehensive panel.

**Location**: `src/pages/TournamentEventDetail.tsx` lines 417-495

**Fix**: Replace the legacy settings content in the "Settings" TabsContent with:
```tsx
<TournamentSettingsPanel eventId={eventId!} />
```

---

### Issue A2: TournamentScheduler Not Accessible

**Problem**: The `TournamentScheduler` component is complete but has no route or tab to access it from the admin interface.

**Location**: Component exists at `src/components/tournament/scheduling/TournamentScheduler.tsx`

**Fix**: Add a "Scheduler" tab to `TournamentEventDetail.tsx` that renders:
```tsx
<TournamentScheduler 
  eventId={eventId!} 
  startDate={event.start_date} 
  endDate={event.end_date} 
  numCourts={4} // or fetch from tournament_courts
/>
```

---

### Issue A3: SeedingManager Not Used

**Problem**: The `SeedingManager` component exists but the `TeamsPanel` still uses an inline seed number input instead of the full seeding manager.

**Location**: `src/components/tournament/TeamsPanel.tsx` lines 86-114 (legacy seed editing)

**Fix**: Add a "Manage Seeding" button in `TeamsPanel` or `TournamentDivisionDetail` that opens the `SeedingManager` in a dialog or dedicated view.

---

### Issue A4: PlayerScoreEntry Not Connected

**Problem**: The `PlayerScoreEntry` component for player self-reporting is complete but:
- Not integrated into any player-facing page
- `ScoreEntryDialog` (admin) doesn't check the `allow_player_score_entry` setting
- No route exists for players to access score entry

**Fix**: 
1. Create a player-facing score entry route at `/tournament/{eventId}/match/{matchId}/score`
2. Update `ScoreEntryDialog` to conditionally show player entry option based on event settings

---

### Issue A5: EmailTemplateEditor Not Accessible

**Problem**: The `EmailTemplateEditor` component exists but there's no UI path to access it from tournament administration.

**Location**: `src/components/tournament/communication/EmailTemplateEditor.tsx`

**Fix**: Add "Email Templates" section to the Settings tab or create a Communication sub-tab in `TournamentEventDetail.tsx`.

---

## Category B: Database/Schema Alignment Issues

### Issue B1: TournamentScheduler Uses Wrong Division IDs

**Problem**: In `TournamentScheduler.tsx` line 108, the matches query uses `divisions.map(d => d.id)` but at that point `divisions` state is empty (it was just set on line 89 but the state update is async).

**Code**:
```typescript
// Line 89: Just set divisions
setDivisions(divisionsData);

// Line 108: divisions is still empty []!
.in("division_id", divisions.map(d => d.id) || [])
```

**Fix**: Use `divisionsData.map(d => d.id)` directly or restructure the fetch logic.

---

### Issue B2: SeedingManager Missing captain_user_id Query

**Problem**: `SeedingManager` fetches `player1_id` but the `send-court-assignment` edge function expects `captain_user_id`. The database uses `player1_id` and `player2_id`, not `captain_user_id`.

**Location**: `supabase/functions/send-court-assignment/index.ts` line 47

**Fix**: Update edge function to use `player1_id` and `player2_id` instead of `captain_user_id` and `partner_user_id`.

---

### Issue B3: opponent_confirmed_at Column Missing in Query

**Problem**: `PlayerScoreEntry` updates `opponent_confirmed_at` (line 171) but this column was added in migration. Need to verify it's being selected properly.

**Fix**: Ensure the select query on line 90 includes `opponent_confirmed_at` field.

---

### Issue B4: Registration Doesn't Check Event Settings

**Problem**: `TournamentRegister.tsx` doesn't fetch or use `tournament_event_settings` to:
- Validate max events per player
- Enforce partner account requirement
- Collect required info (emergency contact, address)

**Fix**: Fetch settings in registration flow and apply validation logic.

---

## Category C: Feature Access Control Gaps

### Issue C1: New Features Not in Feature List

**Problem**: The `tournamentFeatures.ts` defines feature gates, but new features (Scheduler, Seeding, Player Score Entry) aren't added.

**Location**: `src/lib/tournamentFeatures.ts`

**Fix**: Add new features:
```typescript
{
  id: "advanced_seeding",
  name: "Advanced Seeding",
  requiredTier: "plus",
},
{
  id: "visual_scheduler",
  name: "Visual Scheduler",
  requiredTier: "pro",
},
{
  id: "player_score_entry",
  name: "Player Score Entry",
  requiredTier: "plus",
}
```

---

## Category D: Data Flow & Integration Gaps

### Issue D1: Division Eligibility Not Validated on Register

**Problem**: Divisions now have `skill_level_min/max`, `age_min/max`, `gender` fields but `RegistrationStepDivision` only displays these badges - it doesn't actually validate player eligibility.

**Fix**: Add validation functions:
- Compare player rating against division skill requirements
- Calculate player age on the age determination date
- Check gender compatibility

---

### Issue D2: Early Bird Pricing Not Applied

**Problem**: Divisions have `early_bird_fee` and `early_bird_deadline` but the registration flow doesn't calculate/display the correct price based on current date.

**Fix**: Update `RegistrationStepDivision` and `RegistrationStepReview` to:
1. Check if current date is before `early_bird_deadline`
2. Display early bird price with savings callout
3. Use correct fee in payment calculation

---

### Issue D3: TournamentQuickFacts Not Fetching All Data

**Problem**: `TournamentQuickFacts` now accepts `eventSettings` prop but some dynamic facts depend on division data (skill levels, age groups) that isn't being aggregated.

**Location**: `src/components/tournament/landing/TournamentQuickFacts.tsx`

**Fix**: Aggregate min/max skill levels and age ranges across all divisions to display "3.0 - 4.5" instead of just first division's data.

---

### Issue D4: Court Assignment Edge Function Missing court_number Mapping

**Problem**: The `send-court-assignment` function updates `court_number` (integer) but the scheduler works with `court_id` (UUID). These are different fields.

**Fix**: Either:
- Add court_number lookup from court_id, or
- Update the edge function to accept court_id and look up the court name

---

### Issue D5: Realtime Hook Not Filtering by Division

**Problem**: `useTournamentRealtime` subscribes to ALL changes on `tournaments_matches` table, not filtered by event or division. This could cause performance issues with many concurrent tournaments.

**Fix**: Add filter to the subscription:
```typescript
.on('postgres_changes', {
  event: '*',
  schema: 'public',
  table: 'tournaments_matches',
  filter: `division_id=in.(${divisionIds.join(',')})`
}, onMatchUpdate)
```

---

## Implementation Priority Order

### Sprint 1: Critical Integration (Fixes A1, A2, A3, B1)
1. Integrate `TournamentSettingsPanel` into Settings tab
2. Add Scheduler tab with proper data fetching fix
3. Add Seeding access from division detail page
4. Fix scheduler's division ID query bug

### Sprint 2: Player Experience (Fixes A4, D1, D2)
1. Create player score entry route
2. Add eligibility validation to registration
3. Implement early bird pricing logic

### Sprint 3: Data Integrity (Fixes B2, B3, B4, D3)
1. Fix edge function column names
2. Add settings validation to registration
3. Aggregate division data for QuickFacts

### Sprint 4: Polish & Performance (Fixes A5, C1, D4, D5)
1. Add email template editor UI access
2. Add new feature definitions
3. Fix court assignment mapping
4. Optimize realtime subscriptions

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/TournamentEventDetail.tsx` | Add Settings Panel, Scheduler tab, Email Templates |
| `src/pages/TournamentDivisionDetail.tsx` | Add SeedingManager access |
| `src/components/tournament/scheduling/TournamentScheduler.tsx` | Fix division ID query bug |
| `src/components/tournament/RegistrationStepDivision.tsx` | Add eligibility validation, early bird pricing |
| `src/components/tournament/RegistrationStepReview.tsx` | Show correct pricing |
| `src/pages/TournamentRegister.tsx` | Fetch event settings, apply validation |
| `src/lib/tournamentFeatures.ts` | Add new feature definitions |
| `src/hooks/useTournamentRealtime.ts` | Add division filter |
| `supabase/functions/send-court-assignment/index.ts` | Fix column names |
| `src/components/tournament/landing/TournamentQuickFacts.tsx` | Aggregate division data |

---

## New Files to Create

| File | Purpose |
|------|---------|
| `src/pages/TournamentMatchScore.tsx` | Player-facing score entry page |
| `src/lib/tournamentValidation.ts` | Eligibility validation utilities |
| `src/lib/tournamentPricing.ts` | Early bird pricing calculation |

---

## Expected Outcome

After implementing these fixes:

1. All new components will be accessible from the tournament admin UI
2. Database queries will correctly reference existing columns
3. Player eligibility will be validated before registration
4. Early bird pricing will work correctly
5. Player score entry will be available when enabled
6. Realtime updates will be performant and scoped
7. Court assignment emails will work with correct data

