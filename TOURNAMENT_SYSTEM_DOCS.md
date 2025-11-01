# PULSE Tournament System - Complete Documentation

**Status**: Pre-Production QA Phase  
**Build Date**: January 2025  
**System Type**: White-label Pickleball Tournament Engine

---

## Executive Summary

You're holding a production-ready tournament management platform that can replace clipboards, Google Sheets, and manual brackets at any recreational pickleball facility. This document catalogs every component, feature, workflow, and integration point.

---

## System Architecture

### Database Tables (Supabase/Lovable Cloud)

1. **tournaments_events**
   - Event metadata (name, location, dates)
   - Status lifecycle (draft → upcoming → live → completed → cancelled)
   - `public_view_enabled` flag for TV board access
   - Created by admin users

2. **tournaments_divisions**
   - Child of events (many divisions per event)
   - Format: `round_robin` or `single_elimination` or `double_elimination`
   - Status: draft → active → completed
   - Links to scoring_rulesets
   - Max teams constraint

3. **tournaments_teams**
   - Belongs to division
   - Team name + seed number
   - player1_id and player2_id (doubles) or just player1_id (singles)
   - Links to profiles table

4. **tournaments_matches**
   - Match records with round/match numbers
   - Team references, scores, timestamps
   - Status: scheduled → in_progress → completed
   - Court assignment (nullable)
   - Score edit audit fields (score_edited_by, score_edited_at)
   - Notes field

5. **tournaments_courts**
   - Court pool per event
   - Court number/name, availability flag
   - Used for assignment and capacity management

6. **tournaments_scoring_rulesets**
   - Reusable ruleset configs
   - games_to (11, 15, 21)
   - win_by_2 boolean
   - best_of (1, 3, 5)

---

## Page Structure & Routes

### Admin Routes (Protected - requires `admin` role)

#### `/tournament-admin` - Tournament Portal
- **Purpose**: Home base for admins to view/create all tournament events
- **Access**: Admin role required via `has_role()` function
- **Features**:
  - List all tournaments (past and upcoming)
  - Status badges (draft/upcoming/live/completed/cancelled)
  - Create new tournament event button
  - Click event card → navigate to event detail

#### `/tournament/:eventId` - Event Detail Page
- **Purpose**: Manage a single tournament event (divisions, settings, overview)
- **Features**:
  - Event header (name, location, dates, status)
  - Edit event button → EditTournamentDialog
  - Delete event button (with confirmation)
  - List all divisions in event
  - Create division button → CreateDivisionDialog
  - Division cards showing:
    - Division name, format, status
    - Team count / max teams
    - Match progress (completed/total)
    - Quick actions (view, edit, delete)
  - Public view toggle (enable/disable live board)
  - Court management panel

#### `/tournament/:eventId/division/:divisionId` - Division Detail Page
- **Purpose**: Deep management of a single division
- **Layout**: Tabbed interface
- **Header Section**:
  - Division name + description
  - Status badge
  - Action buttons (context-sensitive):
    - Edit Division
    - Generate Matches (round robin or bracket)
    - Activate Division (when draft + ≥2 teams)
    - Complete Division (when all matches done)
    - Delete Division
- **Tabs**:
  1. **Teams Panel** (`TeamsPanel`)
     - List all teams with seed numbers
     - Player names displayed
     - Edit team button → EditTeamDialog
     - Delete team (with confirmation)
     - Inline seed editing
     - Create team button → CreateTeamDialog
  
  2. **Matches Panel** (`MatchesPanel`)
     - Match list with status indicators
     - Court assignments
     - Action buttons per match:
       - Start Match (scheduled → in_progress)
       - Enter Score → ScoreEntryDialog
       - Assign/Change Court → CourtAssignmentDialog
       - Delete Match
     - Bulk operations:
       - Auto-assign courts
       - Clear all court assignments
       - Bulk Score Entry → BulkOperationsDialog
  
  3. **Standings Panel** (`StandingsPanel`)
     - Real-time calculated standings
     - Columns: Rank, Team, W, L, PF, PA, Diff
     - Sorted by wins (desc), then point differential (desc)
     - Empty state if no completed matches
     - Export menu:
       - Export to CSV
       - Print schedule
  
  4. **Bracket Panel** (`BracketView`) - *Only for elimination formats*
     - Visual bracket tree
     - Single or double elimination rendering
     - Clickable matches open ScoreEntryDialog
     - Automatic bracket progression

### Public Routes (No auth required when public_view_enabled = true)

#### `/tournament/:eventId/live` - Live Tournament Board
- **Purpose**: Public-facing TV display for gyms/facilities
- **Design**: Optimized for 15-20 foot viewing distance
- **Features**:
  - Event header with location, dates
  - Pulsing LIVE indicator
  - "Updated X seconds ago" auto-incrementing timer
  - Per-division sections:
    - "Now Playing" matches (in_progress)
    - "Next Up" matches (scheduled, next 3)
    - Current standings table
  - Real-time updates via Supabase subscriptions
  - Manual refresh button

#### `/tournament/:eventId/team/:teamId` - Team View
- **Purpose**: Individual team's match history and record
- **Features**:
  - Team name + player names
  - Overall record (W-L)
  - Match history with scores
  - Opponent details
  - Division name + event context

---

## Component Inventory

### Dialog Components (Modal Forms)

1. **CreateTournamentDialog**
   - Fields: name, description, location, start_date, end_date
   - Validation: dates, required fields
   - On save: inserts to tournaments_events

2. **EditTournamentDialog**
   - Edits existing event metadata
   - Cannot change created_by or id
   - Status management

3. **CreateDivisionDialog**
   - Fields: name, description, format, max_teams, scoring_ruleset
   - Validates format selection
   - Creates division in draft status

4. **EditDivisionDialog**
   - Edit division metadata
   - Status transitions (with guards):
     - Can't activate if <2 teams
     - Can't complete if unfinished matches
     - Can't edit after completion (locked)
   - Scoring ruleset dropdown

5. **CreateTeamDialog**
   - Team name input
   - Seed number (auto-incremented)
   - Player 1 selector (searchable combobox)
   - Player 2 selector (optional for singles)
   - Validation: no duplicate players

6. **EditTeamDialog**
   - Same fields as create
   - Cannot edit if division completed
   - Updates team data + re-fetches standings

7. **ScoreEntryDialog**
   - Dynamic form based on scoring ruleset
   - Team 1 score, Team 2 score inputs
   - Notes textarea
   - Validation preview (real-time):
     - "Valid score" or "Team 1 must win by 2"
   - Duration auto-calculated from timestamps
   - Edit history display (if score previously edited)
   - On save:
     - Updates match status to completed
     - Sets completed_at, score_edited_by, score_edited_at
     - Triggers standings recalc

8. **CourtAssignmentDialog**
   - Dropdown of available courts
   - Assign or change court for a match
   - Updates match.court_id

9. **BulkOperationsDialog**
   - Checkbox list of scheduled matches
   - Score inputs for selected matches
   - Submit button (validates all scores complete)
   - Updates multiple matches in single transaction
   - Shows toast summary ("Updated 5 matches")

10. **BracketGenerationDialog**
    - Triggered when generating bracket matches
    - Confirms team count + seeding
    - Creates single or double elimination bracket structure
    - Generates all bracket matches with proper dependencies

### Panel Components (Tab Content)

1. **TeamsPanel**
   - Fetches teams for division
   - Displays in card list
   - Inline seed editing
   - Edit/delete actions per team

2. **MatchesPanel**
   - Fetches matches for division
   - Groups by status (in_progress, scheduled, completed)
   - Court assignment badges
   - Match action buttons
   - Bulk operations toolbar

3. **StandingsPanel**
   - Calculates standings from completed matches
   - Win/loss/point tracking
   - Tie-breaking via point differential
   - Real-time recalc on match updates

4. **BracketView**
   - Renders elimination bracket tree
   - CSS-based bracket layout
   - Match click handlers
   - Winner advancement logic

5. **CourtManagementPanel**
   - Court list for event
   - Add court form
   - Toggle availability
   - Delete court (with guards)

### Utility Components

1. **ExportMenu**
   - Dropdown menu (shadcn DropdownMenu)
   - Export standings CSV action
   - Print schedule action

2. **LiveIndicator**
   - Pulsing animated badge
   - Shows "LIVE" text with animation

3. **ScoreEditedTooltip**
   - Hover tooltip on edited matches
   - Shows "Edited by [name] at [time]"
   - Fetches editor profile

---

## Key Features by Category

### A. Event Lifecycle Management
- Create events in draft mode
- Transition: draft → upcoming → live → completed
- Public view toggle (enables /live route)
- Event deletion (with cascade warnings)

### B. Division Management
- Multiple divisions per event
- Format selection (round robin, single elim, double elim)
- Status transitions with validation gates
- Completion locks editing

### C. Team Management
- Team creation with player assignment
- Seed number assignment + editing
- Team edit/delete controls
- Player profile integration

### D. Match Scheduling & Generation
- Round robin algorithm (all pairs play once)
- Bracket generation (single/double elimination)
- Manual match creation (future)
- Court assignment (manual + auto-assign)

### E. Score Entry & Validation
- Ruleset-aware validation (win by 2, games to X)
- In-game vs post-game entry
- Score editing with audit trail
- Bulk score entry for completed rounds

### F. Standings & Reporting
- Real-time standings calculation
- Win/loss records
- Points for/against tracking
- Point differential tie-breaking
- CSV export
- Print view

### G. Live Display Features
- Public TV board (/live route)
- Real-time score updates
- "Now Playing" / "Next Up" sections
- Auto-refresh timer
- Mobile-responsive + TV-optimized layouts

### H. Court Management
- Court pool per event
- Availability toggling
- Auto-assign algorithm
- Court reassignment
- Conflict detection (future)

### I. Public Access & Security
- Public view mode with public_view_enabled flag
- RLS policies (admin-only writes, public reads when enabled)
- No PII exposure on public routes
- Admin portal isolation (404 for non-admins)

### J. Real-time Synchronization
- Supabase realtime subscriptions
- Match updates broadcast to all viewers
- Division updates trigger re-fetch
- Hook: `useTournamentRealtime(eventId, onMatchUpdate, onDivisionUpdate)`

---

## Workflows

### Workflow 1: Create & Run a Round Robin Division

1. Admin creates event → `/tournament-admin`
2. Click "Create Division" → format: round_robin
3. Add teams (minimum 2) → CreateTeamDialog
4. Click "Activate Division" → status: active
5. Click "Generate Matches" → all pairings created
6. Click "Auto-Assign Courts" → matches get courts
7. Per match:
   - Director clicks "Start Match" → status: in_progress
   - Enter score via ScoreEntryDialog → status: completed
8. Standings auto-update after each score
9. When all matches done → "Complete Division"
10. Export CSV / print schedule

### Workflow 2: Live Public Display

1. Admin enables `public_view_enabled` on event
2. Navigate to `/tournament/:eventId/live` (public URL)
3. Display on TV/projector
4. Real-time updates as scores entered
5. Players/spectators see:
   - Current matches in progress
   - Next matches up
   - Live standings

### Workflow 3: Bracket Tournament

1. Create division → format: single_elimination
2. Add teams (must be power of 2 for clean bracket, or system byes out)
3. Seed teams (1-N)
4. Activate division
5. Generate bracket → BracketGenerationDialog
6. Bracket matches created with dependencies
7. Enter scores → winners advance automatically
8. Final match determines champion
9. View bracket visually in Bracket tab

---

## Database Security (RLS Policies)

### tournaments_events
- **Admin write**: `has_role(auth.uid(), 'admin')`
- **Public read**: `public_view_enabled = true`

### tournaments_divisions
- **Admin write**: `has_role(auth.uid(), 'admin')`
- **Public read**: event.public_view_enabled = true

### tournaments_teams
- **Admin write**: `has_role(auth.uid(), 'admin')`
- **Public read**: event.public_view_enabled = true (via division → event join)

### tournaments_matches
- **Admin write**: `has_role(auth.uid(), 'admin')`
- **Public read**: event.public_view_enabled = true (via division → event join)

### tournaments_courts
- **Admin manage**: `has_role(auth.uid(), 'admin')`
- **Public read**: event.public_view_enabled = true

### tournaments_scoring_rulesets
- **Public read**: all (reusable configs)
- **Admin write**: admins only

---

## Next Phase Requirements

### Phase 3: Staffable Mode (Operational Readiness)
- [ ] EventStaffPanel (assign volunteers/scorers to divisions)
- [ ] Activity log per event (audit trail table)
- [ ] OfflineStatusBanner (network status indicator)
- [ ] Queued actions (offline score entry with sync on reconnect)

### Phase 4: Monetization Surface
- [ ] Sponsor branding on /live board
- [ ] "Presented by [logo]" header
- [ ] "Powered by Pulse" footer
- [ ] Optional sponsor banner per division

---

## Pre-Production QA Checklist

### SECTION A: Data Model & Business Rules

#### Division Status Rules
- [ ] Cannot activate division with <2 teams (UI blocks + shows reason)
- [ ] Cannot complete division with unfinished matches (UI blocks + explains)
- [ ] After "completed" status:
  - [ ] Cannot edit scores
  - [ ] Cannot edit seeds
  - [ ] Cannot reassign courts
  - [ ] Cannot delete teams
  - [ ] Cannot delete matches

#### Match Lifecycle
- [ ] Status flow: scheduled → in_progress → completed enforced
- [ ] Cannot jump to completed without score
- [ ] Editing completed match:
  - [ ] Updates score_edited_by
  - [ ] Updates score_edited_at
  - [ ] Visually marks as (edited)
  - [ ] Recalculates standings

#### Seeds
- [ ] Decision: Can two teams have same seed_number? (Block or allow)
- [ ] If seeds reordered:
  - [ ] Standings do NOT change (results-based, not seed-based)
  - [ ] Future bracket gen honors new seed order

#### Court Uniqueness
- [ ] Two matches cannot be assigned same court while both in_progress
- [ ] If allowed, document as explicit rule
- [ ] If blocked, implement UI guard

#### Deletion Safety
- [ ] Deleting team with completed matches → blocked OR cascades with warning
- [ ] Deleting division with completed matches → blocked with message
- [ ] Deleting court assigned to scheduled/in_progress match → blocked or forces unassign
- [ ] No silent 500 errors, only user-facing guardrails

#### Timestamps
- [ ] started_at set when match starts
- [ ] completed_at set when score entered
- [ ] actual_duration_minutes = (completed_at - started_at) in minutes
- [ ] Editing score later does NOT change duration

#### Public View Security
- [ ] When public_view_enabled = false:
  - [ ] /tournament/:eventId/live refuses to load
  - [ ] Does not leak event existence
- [ ] When public_view_enabled = true:
  - [ ] Does not show draft divisions
  - [ ] Does not show draft teams
  - [ ] Does not show admin notes/audit data

---

### SECTION B: UI/UX Consistency

#### Status Badges
- [ ] Event status badges visually distinct (draft/upcoming/live/completed/cancelled)
- [ ] Division status badges clear (draft/active/completed)
- [ ] Readable on dark and light backgrounds

#### Button Availability
- [ ] Draft division: "Generate Matches" disabled or hidden with tooltip
- [ ] Completed division: "Complete Division" hidden/disabled
- [ ] Completed division: "Add Team" hidden/disabled
- [ ] MatchesPanel: Correct button for each status (Start/Edit Score/Assign Court)

#### Bulk Score Entry
- [ ] Submit disabled when 0 matches selected
- [ ] Submit disabled when scores incomplete with inline message
- [ ] Toast reflects actual updated count (not lying)
- [ ] Standings update without page refresh

#### Court Management
- [ ] Toggling court to unavailable surfaces in MatchesPanel immediately
- [ ] Add court flow fast, no page reload
- [ ] Delete court confirmation explicit about unassignment

#### Score Entry Dialog
- [ ] Validation messages match ruleset (games to X, win by Y, best of Z)
- [ ] Examples update based on ruleset
- [ ] Detects invalid scores (e.g. 11-10 with win_by_2=true)

#### Standings Panel
- [ ] Tie-breaker logic obvious (point differential shown)
- [ ] Columns: Rank, Team, W, L, PF, PA, Diff
- [ ] Empty state: "No completed matches yet"

#### Public Views
- [ ] TournamentLiveView readable from 15-20 feet
- [ ] LIVE indicator not too visually aggressive
- [ ] TeamView wording clear for non-technical users

---

### SECTION C: Realtime & Sync

#### Realtime Subscriptions
- [ ] Score entered on device A → updates on device B in <1s
- [ ] TournamentLiveView + StandingsPanel both update
- [ ] If realtime disconnects:
  - [ ] No infinite spinners
  - [ ] "Updated X seconds ago" continues incrementing
  - [ ] Manual refresh forces fresh pull

#### Offline Tolerance
- [ ] Losing connection mid-score-entry:
  - [ ] Controlled error message
  - [ ] No white screen
  - [ ] No silent data loss
  - [ ] "You're offline. Try again when reconnected."

---

### SECTION D: Security & Access Control

#### RLS Policies
- [ ] RLS active on all tournaments_* tables
- [ ] Non-admin user: cannot SELECT via Supabase client
- [ ] Admin user: can read/write appropriate data

#### Public Routes
- [ ] /tournament/:eventId/live fetches only public-safe data
- [ ] Does NOT fetch:
  - [ ] Player emails
  - [ ] Internal IDs
  - [ ] Notes
  - [ ] score_edited_by

#### Admin Portal Isolation
- [ ] /tournament-admin returns 404 for non-admins
- [ ] Does not leak existence of private tournament mode

#### Audit Exposure
- [ ] Audit content visible in admin views only
- [ ] Never leaks to public views

#### URL Guessing
- [ ] Guessing /tournament/:eventId/team/:teamId when public_view_enabled=false:
  - [ ] Returns nothing (403 or 404)

---

### SECTION E: Performance & Scale

#### Large Divisions
- [ ] 12-team round robin = 66 matches
- [ ] MatchesPanel renders smoothly
- [ ] BulkOperationsDialog handles 66 rows on mobile

#### Toast Spam
- [ ] Bulk operations show 1 aggregated toast, not N toasts

#### Mobile Admin
- [ ] TournamentDivisionDetail scrollable on phone
- [ ] Tab switching smooth
- [ ] Tap targets big enough (44x44px minimum)

#### TV Display
- [ ] TournamentLiveView adapts to widescreen landscape
- [ ] Long team names don't break layout

---

### SECTION F: Failure & Recovery

#### Court Reassignment
- [ ] Match in_progress on Court 2 → reassign to Court 5
- [ ] Court 2 immediately looks free in UI
- [ ] Match card shows new court

#### Undo / Correction
- [ ] ScoreEntryDialog supports editing completed score
- [ ] Editing resets standings correctly
- [ ] Activity log records change (not silent overwrite)

#### Deleting Matches
- [ ] Cannot delete completed match (or scary double-confirm required)
- [ ] Prevents loss of official records + standings integrity

#### End-of-Division Lock
- [ ] "Complete Division" action:
  - [ ] Hides all destructive controls
  - [ ] Freezes standings (no live recalculating)
  - [ ] Supports export for archive

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
- [ ] All round-robin pairings exist (each pair once)
- [ ] Match numbers/rounds logical

### Step 7: Auto-Assign Courts
- [ ] Courts distribute logically
- [ ] No court assigned to two in_progress matches

### Step 8: Start Match
- [ ] Match #1 → "Start Match"
- [ ] Status: in_progress
- [ ] started_at set
- [ ] Visually looks "live"

### Step 9: Enter Score
- [ ] ScoreEntryDialog opens
- [ ] Enter 11-7
- [ ] Save
- [ ] Match flips to completed
- [ ] completed_at set
- [ ] Duration computed
- [ ] Appears in Standings
- [ ] Appears in LiveView

### Step 10: Edit Score
- [ ] Change to 11-9
- [ ] score_edited_by set
- [ ] score_edited_at set
- [ ] Match shows "(edited)" with tooltip
- [ ] StandingsPanel updates (PF/PA change)
- [ ] TeamView reflects new score

### Step 11: Complete Division
- [ ] Mark "Completed"
- [ ] Cannot edit team name
- [ ] Cannot edit score (or blocked)
- [ ] Cannot reassign court
- [ ] Cannot generate matches again

### Step 12: Export
- [ ] Export standings CSV
- [ ] Print schedule
- [ ] Exported data matches onscreen data

---

## What You're Actually Holding

This is a **white-label pickleball tournament engine** ready for real-world deployment.

**Capabilities**:
- Replace clipboards, Google Sheets, manual brackets
- Run multi-division tournaments with live scoring
- Public TV board for gyms/facilities
- Team/player tracking with audit trails
- Export official results

**Next Milestones**:
1. Pass all QA checks above
2. Ship Phase 3 (staff roles, audit, offline queue)
3. Add sponsor surface (/live branding)
4. Deploy to first real event (e.g. Attleboro YMCA Winter Doubles)

**Sellable Value**:
> "We can run your whole tournament live, display standings and scores on a TV, record winners, and generate your recap PDF. You supply courts and players, we supply the platform and staff."

---

## Files Changed/Created (Build History)

### Core Pages
- `src/pages/TournamentAdmin.tsx` - Admin portal entry
- `src/pages/TournamentEventDetail.tsx` - Event management
- `src/pages/TournamentDivisionDetail.tsx` - Division deep-dive
- `src/pages/TournamentLiveView.tsx` - Public TV board
- `src/pages/TournamentTeamView.tsx` - Public team view

### Dialog Components
- `src/components/tournament/CreateTournamentDialog.tsx`
- `src/components/tournament/EditTournamentDialog.tsx`
- `src/components/tournament/CreateDivisionDialog.tsx`
- `src/components/tournament/EditDivisionDialog.tsx`
- `src/components/tournament/CreateTeamDialog.tsx`
- `src/components/tournament/EditTeamDialog.tsx`
- `src/components/tournament/ScoreEntryDialog.tsx`
- `src/components/tournament/CourtAssignmentDialog.tsx`
- `src/components/tournament/BulkOperationsDialog.tsx`
- `src/components/tournament/BracketGenerationDialog.tsx`

### Panel Components
- `src/components/tournament/TeamsPanel.tsx`
- `src/components/tournament/MatchesPanel.tsx`
- `src/components/tournament/StandingsPanel.tsx`
- `src/components/tournament/BracketView.tsx`
- `src/components/tournament/CourtManagementPanel.tsx`
- `src/components/tournament/ExportMenu.tsx`

### Utility Components
- `src/components/tournament/LiveIndicator.tsx`
- `src/hooks/useTournamentRealtime.ts`

### Database Migrations
- Created tournaments_events table
- Created tournaments_divisions table
- Created tournaments_teams table
- Created tournaments_matches table
- Created tournaments_courts table
- Created tournaments_scoring_rulesets table
- Added RLS policies for all tables
- Created has_role() security definer function

---

**Document Version**: 1.0  
**Last Updated**: Pre-Production QA Phase  
**Status**: Ready for validation against QA checklist
