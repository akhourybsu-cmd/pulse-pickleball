# Tournament System - QA Testing Guide

**Purpose**: Walk through actual testing scenarios to validate all QA checkpoints before real-world deployment.

---

## Pre-Test Setup

1. **Create test admin account**
   - Navigate to `/auth`
   - Sign up with test account
   - Add `admin` role via database manually:
     ```sql
     INSERT INTO user_roles (user_id, role)
     VALUES ('<your-user-id>', 'admin');
     ```

2. **Open two browser sessions**
   - Session A: Logged in as admin
   - Session B: Incognito (public view testing)

3. **Open dev tools in both**
   - Console tab (check for errors)
   - Network tab (check API calls)
   - Application tab (check realtime subscriptions)

---

## Test Suite 1: Division Status Rules

### Test 1A: Cannot Activate with <2 Teams

**Steps**:
1. Navigate to `/tournament-admin`
2. Create event: "QA Test Event"
3. Create division: "Test Division", Round Robin
4. Add 0 teams
5. Click "Activate Division"

**Expected**:
- ❌ Error toast: "You need at least 2 teams to activate a division"
- Division status remains "draft"

**Actual**: ___________

---

### Test 1B: Can Activate with ≥2 Teams

**Steps**:
1. Same division from 1A
2. Add 2 teams (Team A, Team B)
3. Click "Activate Division"

**Expected**:
- ✅ Success toast: "Division activated"
- Status badge shows "Active"

**Actual**: ___________

---

### Test 1C: Cannot Complete with Unfinished Matches

**Steps**:
1. Same division from 1B
2. Generate matches (creates 1 match)
3. Leave match in "scheduled" status
4. Try to click "Complete Division"

**Expected**:
- Database trigger prevents completion
- Error message about unfinished matches

**Actual**: ___________

---

### Test 1D: Can Complete When All Matches Done

**Steps**:
1. Same division from 1C
2. Start match → Enter score (11-7) → Save
3. Match status = "completed"
4. Click "Complete Division"

**Expected**:
- ✅ Success toast: "Division completed"
- Status badge shows "Completed"
- All edit buttons hidden/disabled

**Actual**: ___________

---

### Test 1E: Cannot Edit Completed Division

**Steps**:
1. Same completed division from 1D
2. Try to:
   - Add a new team
   - Edit existing team name
   - Delete a team
   - Change a match score
   - Delete a match
   - Reassign a court

**Expected**:
- All actions blocked by database triggers
- Error messages clear
- UI hides/disables impossible actions

**Actual**: ___________

---

## Test Suite 2: Match Lifecycle

### Test 2A: Cannot Complete Match Without Score

**Steps**:
1. Create new division with 2 teams
2. Activate → Generate matches
3. Try to manually update match status to "completed" via:
   ```sql
   UPDATE tournaments_matches 
   SET status = 'completed' 
   WHERE id = '<match-id>';
   ```

**Expected**:
- ❌ Database trigger blocks: "Cannot mark match as completed without scores"

**Actual**: ___________

---

### Test 2B: Score Entry Sets Timestamps

**Steps**:
1. Create match
2. Click "Start Match"
3. Wait 60 seconds
4. Click "Enter Score" → 11-8 → Save

**Expected**:
- `started_at` timestamp set when started
- `completed_at` timestamp set when completed
- `actual_duration_minutes` ≈ 1 minute
- All visible in database query

**Actual**: ___________

---

### Test 2C: Editing Score Updates Audit Fields

**Steps**:
1. Same completed match from 2B
2. Click "Edit Score"
3. Change to 11-9
4. Save

**Expected**:
- `score_edited_by` = your user_id
- `score_edited_at` = current timestamp
- Match card shows "(edited)" indicator with tooltip
- Duration UNCHANGED from original
- Standings recalculate

**Actual**: ___________

---

## Test Suite 3: Court Management

### Test 3A: Court Conflict Prevention

**Steps**:
1. Create event with 1 court
2. Create division with 4 teams
3. Generate matches (6 matches)
4. Start Match #1, assign to Court 1
5. Try to start Match #2, assign to Court 1

**Expected**:
- ❌ Database trigger: "Court conflict: Court is already in use"

**Actual**: ___________

---

### Test 3B: Auto-Assign Courts

**Steps**:
1. Create event with 3 courts
2. Create division with 8 teams
3. Generate matches (28 matches total)
4. Click "Auto-Assign Courts"

**Expected**:
- Courts distributed evenly (round-robin)
- Toast: "Assigned X matches to 3 court(s)"
- No court conflicts

**Actual**: ___________

---

## Test Suite 4: Deletion Safety

### Test 4A: Cannot Delete Team with Completed Matches

**Steps**:
1. Create division with 2 teams
2. Generate + complete 1 match with score
3. Try to delete one of the teams

**Expected**:
- ❌ UI blocks deletion
- Message about match history

**Actual**: ___________

---

### Test 4B: Cannot Delete Completed Match

**Steps**:
1. Create match with score entered
2. Click delete button on completed match

**Expected**:
- ❌ UI blocks deletion
- Message: "This match has scores recorded"

**Actual**: ___________

---

### Test 4C: Cannot Delete Completed Division

**Steps**:
1. Complete a division (all matches done)
2. Try to delete the division

**Expected**:
- ❌ UI blocks deletion
- Message about official results

**Actual**: ___________

---

## Test Suite 5: Public View Security

### Test 5A: Public View Disabled (default)

**Steps**:
1. Create event (public_view_enabled = false by default)
2. Create division with teams
3. In incognito window, navigate to:
   - `/tournament/<event-id>/live`
   - `/tournament/<event-id>/team/<team-id>`

**Expected**:
- 404 or "Not Found" error
- No data leak
- No hint event exists

**Actual**: ___________

---

### Test 5B: Public View Enabled

**Steps**:
1. Same event from 5A
2. Toggle "Public View Enabled" ON
3. In incognito window, reload:
   - `/tournament/<event-id>/live`

**Expected**:
- ✅ Page loads successfully
- Shows divisions, teams, matches
- Does NOT show:
  - Draft divisions
  - Admin notes
  - Edit buttons
  - score_edited_by info

**Actual**: ___________

---

## Test Suite 6: Realtime Sync

### Test 6A: Score Entry Updates Live Board

**Steps**:
1. Create event with public view enabled
2. Generate matches
3. Open live board in Session B: `/tournament/<id>/live`
4. In Session A (admin), enter a score

**Expected**:
- Session B updates within <2 seconds
- "Now Playing" changes to "Completed"
- Standings update immediately
- "Updated X seconds ago" timer resets

**Actual**: ___________

---

### Test 6B: Division Update Triggers Refresh

**Steps**:
1. Same setup from 6A
2. In Session A, complete the division
3. Watch Session B

**Expected**:
- Division status badge updates
- Standings frozen
- Export controls appear (if visible)

**Actual**: ___________

---

## Test Suite 7: Scoring Rules Validation

### Test 7A: Win By 2 Enforcement

**Steps**:
1. Create division with ruleset: Games to 11, win by 2, best of 1
2. Generate match
3. Try to enter score: 11-10

**Expected**:
- ❌ Validation error: "Team 1 must win by 2"
- Cannot submit

**Actual**: ___________

---

### Test 7B: Valid Deuce Score

**Steps**:
1. Same setup from 7A
2. Enter score: 13-11

**Expected**:
- ✅ Valid score
- Saves successfully
- Standings update

**Actual**: ___________

---

### Test 7C: Games To = 15

**Steps**:
1. Create division with ruleset: Games to 15, win by 2
2. Generate match
3. Enter score: 15-13

**Expected**:
- ✅ Valid score
- Saves successfully

**Actual**: ___________

---

## Test Suite 8: Bulk Operations

### Test 8A: Bulk Score Entry

**Steps**:
1. Create division with 6 teams (15 matches)
2. Auto-assign courts
3. Click "Bulk Score Entry"
4. Select 5 matches
5. Enter scores for all 5
6. Submit

**Expected**:
- Single toast: "Updated 5 matches"
- NOT 5 separate toasts
- All 5 matches show as completed
- Standings reflect all 5 results

**Actual**: ___________

---

### Test 8B: Bulk Partial Submission

**Steps**:
1. Same as 8A
2. Select 5 matches
3. Enter scores for only 3
4. Try to submit

**Expected**:
- ❌ Submit button disabled
- Inline message: "Complete all scores"

**Actual**: ___________

---

## Test Suite 9: Bracket Generation

### Test 9A: Single Elimination (Power of 2)

**Steps**:
1. Create division: Single Elimination
2. Add 8 teams (seeds 1-8)
3. Activate division
4. Click "Generate Bracket"

**Expected**:
- Creates 7 matches total
- Round 1: 4 matches (seeds paired correctly)
- Round 2: 2 matches (winners advance)
- Round 3: 1 match (finals)

**Actual**: ___________

---

### Test 9B: Bracket View Display

**Steps**:
1. Same bracket from 9A
2. Click "Bracket" tab

**Expected**:
- Visual bracket tree renders
- All matches clickable
- Winners advance when scores entered

**Actual**: ___________

---

## Test Suite 10: Export & Print

### Test 10A: Export Standings CSV

**Steps**:
1. Complete a division with multiple matches
2. Click Export → "Export to CSV"

**Expected**:
- CSV file downloads
- Contains: Rank, Team, W, L, PF, PA, Diff
- Data matches on-screen standings exactly

**Actual**: ___________

---

### Test 10B: Print Schedule

**Steps**:
1. Generate division with multiple rounds
2. Click Export → "Print Schedule"

**Expected**:
- Print dialog opens
- Schedule formatted for printing
- All match info visible

**Actual**: ___________

---

## Test Suite 11: Mobile Responsiveness

### Test 11A: Admin on Mobile

**Steps**:
1. Open `/tournament-admin` on phone
2. Navigate division detail
3. Switch between tabs (Teams, Matches, Standings)

**Expected**:
- All tabs scrollable
- Tap targets ≥44x44px
- No horizontal overflow
- Buttons accessible

**Actual**: ___________

---

### Test 11B: Public View on Mobile

**Steps**:
1. Open `/tournament/<id>/live` on phone

**Expected**:
- Readable from arm's length
- LIVE indicator visible but not distracting
- Team names don't overflow
- Standings table scrollable

**Actual**: ___________

---

## Test Suite 12: TV Display

### Test 12A: Widescreen Layout

**Steps**:
1. Open `/tournament/<id>/live` on widescreen monitor (1920x1080)
2. Enter full-screen mode

**Expected**:
- Readable from 15-20 feet
- No wasted whitespace
- Long team names don't break layout
- LIVE indicator proportional

**Actual**: ___________

---

## 12-Step End-to-End Dry Run

### Step 1: Create Event
- [ ] Create "Monster Smash Winter 2025"
- [ ] Location: "Test Facility"
- [ ] Dates: Today → Tomorrow
- [ ] Status: Draft

### Step 2: Add Division
- [ ] Name: "Men's Open Doubles"
- [ ] Format: Round Robin
- [ ] Ruleset: Games to 11, win by 2, best of 1

### Step 3: Add Courts
- [ ] Add Courts 1-4
- [ ] All available = true

### Step 4: Add Teams
- [ ] Team A (Player 1, Player 2)
- [ ] Team B (Player 3, Player 4)
- [ ] Team C (Player 5, Player 6)
- [ ] Team D (Player 7, Player 8)
- [ ] Seeds: 1, 2, 3, 4

### Step 5: Activate Division
- [ ] Click "Activate Division"
- [ ] Success toast appears
- [ ] "Generate Matches" button now visible

### Step 6: Generate Matches
- [ ] Click "Generate Matches"
- [ ] 6 matches created (each pair plays once)
- [ ] Round numbers logical

### Step 7: Auto-Assign Courts
- [ ] Click "Auto-Assign Courts"
- [ ] All matches get courts
- [ ] Distribution looks even

### Step 8: Start Match #1
- [ ] Click "Start Match" on first match
- [ ] Status → "in_progress"
- [ ] started_at timestamp recorded
- [ ] Visual indicator shows "live"

### Step 9: Enter Score
- [ ] Click "Enter Score"
- [ ] Enter 11-7 for Team A
- [ ] Save
- [ ] Match → "completed"
- [ ] completed_at timestamp
- [ ] Duration calculated
- [ ] Standings show Team A: 1-0

### Step 10: Edit Score
- [ ] Click "Edit Score" on completed match
- [ ] Change to 11-9
- [ ] Save
- [ ] "(edited)" indicator appears
- [ ] Hover shows "Edited by <name> at <time>"
- [ ] Standings update (PF/PA changed)

### Step 11: Complete Division
- [ ] Complete remaining 5 matches
- [ ] Click "Complete Division"
- [ ] Success toast
- [ ] All edit buttons hidden
- [ ] Try to edit team → blocked
- [ ] Try to delete match → blocked

### Step 12: Export
- [ ] Click Export → "Export to CSV"
- [ ] CSV downloads correctly
- [ ] Click Export → "Print Schedule"
- [ ] Print preview correct
- [ ] Data matches on-screen

---

## Critical Path Summary

**Must Pass Before Deployment**:
1. ✅ Division activation requires 2+ teams
2. ✅ Division completion requires all matches done
3. ✅ Completed divisions are locked
4. ✅ Court conflicts prevented
5. ✅ Match deletion safety (completed matches)
6. ✅ Public view security
7. ✅ Realtime updates <2s
8. ✅ Score validation enforces rulesets
9. ✅ Export/print works accurately

**Nice to Have (Can Fix Post-Launch)**:
- Mobile polish
- TV display optimization
- Offline handling
- Performance with 50+ teams

---

## Sign-Off

**Tester**: ___________  
**Date**: ___________  
**Build Version**: ___________

**Overall Assessment**:
- [ ] PASS - Ready for controlled deployment
- [ ] CONDITIONAL PASS - Minor issues noted
- [ ] FAIL - Blocking issues must be fixed

**Notes**: ___________
