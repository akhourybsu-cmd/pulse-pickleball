
# Winter Classic Sample Tournament Setup

## Overview

I'll create a complete sample tournament called **"Winter Classic"** for **Saturday, February 7th, 2026** with 3 divisions, sample teams, and generated matches so you can test all tournament features end-to-end.

---

## Tournament Details

| Field | Value |
|-------|-------|
| Name | Winter Classic |
| Date | Saturday, February 7, 2026 |
| Location | PULSE Test Facility, Cumberland, RI |
| Status | Upcoming (ready for registrations) |
| Custom URL | `/tournament/winter-classic-2026` |
| Created By | Alex Khoury (your admin account) |

---

## 3 Divisions

### Division 1: Mixed Doubles 3.0-3.5
- **Format**: Round Robin
- **Gender**: Mixed (requires 1 male, 1 female per team)
- **Skill Range**: 3.0 - 3.5
- **Registration Fee**: $40/team
- **4 Teams** → 6 matches total

### Division 2: Open Doubles 2.5-3.0
- **Format**: Round Robin  
- **Gender**: Open (any gender combination)
- **Skill Range**: 2.5 - 3.0
- **Registration Fee**: $35/team
- **4 Teams** → 6 matches total

### Division 3: Recreational (All Levels)
- **Format**: Round Robin
- **Gender**: Open
- **Skill Range**: None (all levels welcome)
- **Registration Fee**: $30/team
- **4 Teams** → 6 matches total

---

## Sample Teams (12 Total)

Using real profiles from your database, I'll create teams with proper player links:

### Mixed Doubles 3.0-3.5
1. **Khoury & Lewis** - Alex Khoury + Pam Lewis
2. **Sachleben & Dalton** - Kelly Sachleben + Michael Dalton  
3. **Warren & DeForest** - Jenna Warren + David DeForest
4. **Lotfi & Chalamala** - Bethany Lotfi + Manny Chalamala

### Open Doubles 2.5-3.0
1. **The Underdogs** - Debbie Belanger + Divyesh Dubey
2. **Net Ninjas** - Tharun Bonthu + Test Account1
3. **Dink Dynasty** - Test Account4 + Test Account5
4. **Kitchen Crew** - Adam Khoury + Testing Test

### Recreational Division
1. **Just For Fun** - Linda Chilson + John Balcarcel
2. **Weekend Warriors** - Robert Mammone + Gail Ferr
3. **Pickle Pals** - Benjamin Averill + Kayla Tran
4. **Casual Kings** - Tara Zerfas + John C

---

## Courts (4)

| Court | Name |
|-------|------|
| 1 | Court 1 |
| 2 | Court 2 |
| 3 | Court 3 |
| 4 | Court 4 |

---

## Round Robin Matches (18 Total)

Each division will have 6 matches generated (4 teams = 6 unique pairings):

```text
Division: Mixed Doubles 3.0-3.5
├── Round 1: Match 1 (Team 1 vs Team 2), Match 2 (Team 3 vs Team 4)
├── Round 2: Match 3 (Team 1 vs Team 3), Match 4 (Team 2 vs Team 4)
└── Round 3: Match 5 (Team 1 vs Team 4), Match 6 (Team 2 vs Team 3)

Division: Open Doubles 2.5-3.0
├── Round 1: Match 1 (Team 1 vs Team 2), Match 2 (Team 3 vs Team 4)
├── Round 2: Match 3 (Team 1 vs Team 3), Match 4 (Team 2 vs Team 4)
└── Round 3: Match 5 (Team 1 vs Team 4), Match 6 (Team 2 vs Team 3)

Division: Recreational
├── Round 1: Match 1 (Team 1 vs Team 2), Match 2 (Team 3 vs Team 4)
├── Round 2: Match 3 (Team 1 vs Team 3), Match 4 (Team 2 vs Team 4)
└── Round 3: Match 5 (Team 1 vs Team 4), Match 6 (Team 2 vs Team 3)
```

---

## Match Schedule (Tentative)

All matches scheduled for **February 7, 2026**:

| Time | Court 1 | Court 2 | Court 3 | Court 4 |
|------|---------|---------|---------|---------|
| 9:00 AM | Mixed R1-M1 | Mixed R1-M2 | Open R1-M1 | Open R1-M2 |
| 10:00 AM | Rec R1-M1 | Rec R1-M2 | Mixed R2-M3 | Mixed R2-M4 |
| 11:00 AM | Open R2-M3 | Open R2-M4 | Rec R2-M3 | Rec R2-M4 |
| 12:00 PM | Mixed R3-M5 | Mixed R3-M6 | Open R3-M5 | Open R3-M6 |
| 1:00 PM | Rec R3-M5 | Rec R3-M6 | - | - |

---

## Data Creation Sequence

The data will be inserted in this order to respect foreign key constraints:

1. **tournaments_events** - Main tournament record
2. **tournaments_courts** - 4 courts
3. **tournaments_divisions** - 3 divisions with eligibility rules
4. **tournaments_teams** - 12 teams (4 per division)
5. **tournaments_matches** - 18 matches with scheduled times and court assignments

---

## What You Can Test After Creation

With this sample data, you'll be able to test:

- **Public Landing Page** at `/tournament/winter-classic-2026`
- **Division eligibility** - Skill level and gender restrictions
- **Team management** - Edit, delete, reorder seeds
- **Match scheduling** - Assign courts, set times
- **Score entry** - Enter scores for matches
- **Standings calculation** - See rankings update in real-time
- **Check-in system** - Mark players as checked in
- **Live view** - TV display mode for spectators
- **Status transitions** - Draft → Upcoming → Live → Completed

---

## Technical Details

### Database Inserts

```sql
-- 1. Create tournament event
INSERT INTO tournaments_events (
  name, slug, start_date, end_date, location,
  status, created_by, public_view_enabled, registration_enabled
) VALUES (
  'Winter Classic', 'winter-classic-2026', '2026-02-07', '2026-02-07',
  'PULSE Test Facility, Cumberland, RI', 'upcoming',
  'fff594fe-02ea-439c-a974-72e1f6295f08', true, true
);

-- 2. Create 4 courts
INSERT INTO tournaments_courts (event_id, court_number, court_name, available)
VALUES 
  (event_id, 1, 'Court 1', true),
  (event_id, 2, 'Court 2', true),
  (event_id, 3, 'Court 3', true),
  (event_id, 4, 'Court 4', true);

-- 3. Create 3 divisions with eligibility rules
INSERT INTO tournaments_divisions (
  event_id, name, format, gender, skill_level_min, skill_level_max,
  registration_fee, status
) VALUES 
  (event_id, 'Mixed Doubles 3.0-3.5', 'round_robin', 'mixed', 3.0, 3.5, 40, 'setup'),
  (event_id, 'Open Doubles 2.5-3.0', 'round_robin', 'open', 2.5, 3.0, 35, 'setup'),
  (event_id, 'Recreational', 'round_robin', 'open', NULL, NULL, 30, 'setup');

-- 4. Create 12 teams (4 per division with player links)
INSERT INTO tournaments_teams (division_id, team_name, player1_id, player2_id, seed_number)
VALUES ...

-- 5. Generate 18 round robin matches with scheduling
INSERT INTO tournaments_matches (
  division_id, team1_id, team2_id, round_number, match_number,
  scheduled_time, court_id, status
) VALUES ...
```

---

## Ready to Execute

Once approved, I'll execute all the SQL inserts to create this complete sample tournament. After creation, you can access it at:

- **Admin View**: `/tournaments` → Click "Winter Classic"
- **Public Landing**: `/tournament/winter-classic-2026`
- **Live Scores**: `/tournament/winter-classic-2026/live`
