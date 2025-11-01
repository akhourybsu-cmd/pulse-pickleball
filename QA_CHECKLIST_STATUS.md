# Tournament System QA Checklist - Implementation Status

**Last Updated**: Phase 4 + QA Validation Pass  
**Status**: Database-level validation complete, UI-level safeguards implemented

---

## ✅ SECTION A: Data Model & Business Rules

### Division Status Rules
- [x] **Cannot activate division with <2 teams**
  - Database trigger: `validate_division_activation()`
  - UI check: Pre-validation before API call
  - Error message: "Need at least 2 teams to activate (current: X)"

- [x] **Cannot complete division with unfinished matches**
  - Database trigger: `validate_division_completion()`
  - UI check: Validates scheduled/in_progress count
  - Error message: "X match(es) still in progress or scheduled"

- [x] **After "completed" status, cannot:**
  - [x] Edit scores → Trigger blocks (except edit metadata)
  - [x] Edit seeds → Trigger blocks team modifications
  - [x] Reassign courts → Trigger blocks court_id changes
  - [x] Delete teams → Trigger blocks deletion
  - [x] Delete matches → Trigger blocks deletion

### Match Lifecycle
- [x] **Status flow enforced: scheduled → in_progress → completed**
  - Database trigger: `validate_match_status_transition()`
  - Allows scheduled → completed IF scores provided
  - Cannot complete without scores (validated)

- [x] **Editing completed match**
  - [x] Updates `score_edited_by` (trigger sets auth.uid())
  - [x] Updates `score_edited_at` (trigger sets NOW())
  - [x] Visually marks as "(edited)" (ScoreEditedTooltip component)
  - [x] Recalculates standings (handled by component refresh)
  - [x] Does NOT update duration (trigger preserves original)

### Seeds
- [x] **Unique seed numbers within division**
  - Database constraint: `unique_seed_per_division`
  - Allows NULL seeds
  - UI: Inline editing with validation

- [x] **Seed reordering**
  - Standings are results-based (wins, point differential)
  - Seeds do not affect final standings
  - Future bracket gen will honor current seeds

### Court Uniqueness
- [x] **Cannot assign same court to two in_progress matches**
  - Database trigger: `prevent_court_conflicts()`
  - Checks event-wide court conflicts
  - Error: "Court conflict: Court is already in use"

### Deletion Safety
- [x] **Deleting team with completed matches → blocked**
  - UI check before delete
  - Shows: "Cannot delete teams with match history"

- [x] **Deleting division with completed matches → blocked**
  - UI check if division.status === "completed"
  - Shows: "Official results cannot be deleted"

- [x] **Deleting completed match → blocked**
  - UI check before delete
  - Shows: "Deleting would alter official standings"

- [x] **Deleting court assigned to active match → prevented**
  - Database foreign key cascade rules
  - Should implement UI guard (TODO)

### Timestamps
- [x] **started_at set when match starts**
  - Trigger: `validate_match_status_transition()`
  - Sets on transition to `in_progress`

- [x] **completed_at set when score entered**
  - Trigger: Sets on transition to `completed`

- [x] **actual_duration_minutes computed**
  - Formula: `(completed_at - started_at) / 60`
  - Only if started_at exists

- [x] **Editing score does NOT change duration**
  - Trigger preserves original timestamps

### Public View Security
- [x] **When public_view_enabled = false:**
  - RLS policy blocks public access
  - Event, divisions, teams, matches all hidden
  - No existence leak

- [x] **When public_view_enabled = true:**
  - Only shows active/completed divisions
  - Does not show draft teams/divisions
  - Does not show admin-only fields (notes, audit)

---

## 🔄 SECTION B: UI/UX Consistency (In Progress)

### Status Badges
- [x] Event status badges visually distinct
- [x] Division status badges clear
- [ ] Test on dark/light backgrounds (needs visual QA)

### Button Availability
- [x] Draft division: "Generate Matches" hidden/disabled
- [x] Completed division: "Complete Division" hidden
- [x] Completed division: "Add Team" hidden
- [x] MatchesPanel: Context-appropriate buttons per status

### Bulk Score Entry
- [x] Submit disabled when 0 selected
- [x] Submit disabled when scores incomplete
- [x] Toast reflects actual count
- [x] Standings update without refresh

### Court Management
- [x] Toggle availability surfaces immediately
- [x] Add court fast (no reload)
- [ ] Delete court confirmation explicit (TODO: enhance wording)

### Score Entry Dialog
- [x] Validation messages match ruleset
- [x] Examples update based on ruleset
- [x] Detects invalid scores (win_by_2 violations)

### Standings Panel
- [x] Tie-breaker logic visible (PF/PA/Diff columns)
- [x] Empty state: "No completed matches yet"

### Public Views
- [ ] TournamentLiveView 15-20ft readability (needs visual QA)
- [ ] LIVE indicator not too aggressive (needs visual QA)
- [ ] TeamView wording clear (needs user testing)

---

## 🔄 SECTION C: Realtime & Sync (Implemented, Needs Testing)

### Realtime Subscriptions
- [x] Hook: `useTournamentRealtime`
- [x] Subscribes to match updates
- [x] Subscribes to division updates
- [ ] Test: Score on device A → device B updates <1s
- [ ] Test: Disconnection handling

### Offline Tolerance
- [ ] Controlled error on connection loss
- [ ] No white screen
- [ ] No silent data loss
- [ ] Message: "You're offline..."

---

## ✅ SECTION D: Security & Access Control

### RLS Policies
- [x] RLS active on all tournaments_* tables
- [x] Non-admin: cannot SELECT restricted data
- [x] Admin: full read/write via `has_role()`

### Public Routes
- [x] /tournament/:id/live fetches public-safe data only
- [x] Does NOT fetch PII (emails, internal IDs, notes)

### Admin Portal Isolation
- [x] /tournament-admin returns 404 for non-admins
- [x] Does not leak existence

### Audit Exposure
- [x] Audit data (score_edited_by/at) visible in admin only
- [x] Never leaks to public views

### URL Guessing
- [x] Guessing /tournament/:id when public=false → 403/404
- [x] RLS policy prevents data leak

---

## 🔄 SECTION E: Performance & Scale (Needs Testing)

### Large Divisions
- [ ] Test: 12-team round robin (66 matches)
- [ ] MatchesPanel renders smoothly
- [ ] BulkOperationsDialog handles mobile

### Toast Spam
- [x] Bulk operations: 1 aggregated toast (implemented)

### Mobile Admin
- [ ] TournamentDivisionDetail scrollable on phone
- [ ] Tab switching smooth
- [ ] Tap targets 44x44px minimum

### TV Display
- [ ] TournamentLiveView adapts to widescreen
- [ ] Long team names don't break layout

---

## ✅ SECTION F: Failure & Recovery

### Court Reassignment
- [x] Match in_progress reassigned → old court immediately free
- [x] Match card shows new court

### Undo / Correction
- [x] ScoreEntryDialog supports editing
- [x] Editing resets standings
- [x] Score edit tracked (score_edited_by/at)

### Deleting Matches
- [x] Cannot delete completed match (UI blocked)
- [x] Error: "Deleting would alter official standings"

### End-of-Division Lock
- [x] "Complete Division" hides destructive controls
- [x] Standings frozen (trigger blocks edits)
- [x] Export available (CSV + print)

---

## 12-Step Dry Run Walkthrough

### Step 1: Create Event
- [ ] Name: "Monster Smash Winter 2025"
- [ ] Add location, dates
- [ ] Status: draft

### Step 2: Add Division
- [ ] Name: "Men's Open Doubles"
- [ ] Format: Round Robin
- [ ] Ruleset: Games to 11, win by 2, best of 1
- [ ] Status: Draft

### Step 3: Add Courts
- [ ] Courts 1-4, all available=true

### Step 4: Add Teams
- [ ] Team A, B, C, D
- [ ] Seeds 1, 2, 3, 4
- [ ] Cannot assign same player twice

### Step 5: Activate Division
- [ ] Should allow (≥2 teams exist)
- [ ] "Generate Matches" now available

### Step 6: Generate Matches
- [ ] All round-robin pairings exist
- [ ] Match numbers/rounds logical

### Step 7: Auto-Assign Courts
- [ ] Courts distribute logically
- [ ] No court assigned to two in_progress

### Step 8: Start Match
- [ ] Match #1 → "Start Match"
- [ ] Status: in_progress
- [ ] started_at set
- [ ] Visually "live"

### Step 9: Enter Score
- [ ] ScoreEntryDialog opens
- [ ] Enter 11-7
- [ ] Save
- [ ] Match → completed
- [ ] completed_at set
- [ ] Duration computed
- [ ] Appears in Standings
- [ ] Appears in LiveView

### Step 10: Edit Score
- [ ] Change to 11-9
- [ ] score_edited_by set
- [ ] score_edited_at set
- [ ] "(edited)" with tooltip
- [ ] StandingsPanel updates
- [ ] TeamView reflects new score

### Step 11: Complete Division
- [ ] Mark "Completed"
- [ ] Cannot edit team name
- [ ] Cannot edit score
- [ ] Cannot reassign court
- [ ] Cannot generate matches

### Step 12: Export
- [ ] Export standings CSV
- [ ] Print schedule
- [ ] Data matches onscreen

---

## Summary

**Implemented (Database-level)**:
- ✅ Division activation/completion validation
- ✅ Completed division edit prevention
- ✅ Match status transition rules
- ✅ Court conflict detection
- ✅ Unique seed constraint
- ✅ Score edit tracking
- ✅ Timestamp management

**Implemented (UI-level)**:
- ✅ Pre-flight validation checks
- ✅ User-friendly error messages
- ✅ Delete safety guards
- ✅ Status-aware button visibility

**Needs Testing**:
- Visual QA (dark/light mode, TV displays)
- Performance testing (large divisions)
- Mobile responsiveness
- Realtime sync under load
- Offline behavior
- 12-step dry run end-to-end

**Next Steps**:
1. Run 12-step dry run in staging
2. Visual QA on TV display
3. Mobile device testing
4. Load testing (12+ team division)
5. Deploy Phase 3 (staff roles, audit log)
6. Add sponsor surface for monetization
