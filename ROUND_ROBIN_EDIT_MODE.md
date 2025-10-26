# Round Robin Edit Mode - Implementation Progress

## ✅ Phase 1: Edit Mode Infrastructure & Basic Settings (COMPLETED)

### Database
- ✅ Created `round_robin_audit` table for tracking all changes
- ✅ RLS policies for organizers and admins
- ✅ Indexes for performance

### Components Created
- ✅ `EditEventDialog` - Dialog for editing event settings
- ✅ `EditModeBanner` - Visual indicator when in edit mode

### Features Implemented
- ✅ Edit mode toggle button (Settings button in header)
- ✅ Event settings editing:
  - Name
  - Notes
  - Rating eligible (toggle)
  - Match type (Ladder/League/Playoffs/Casual)
- ✅ Audit trail logging for all changes
- ✅ Changes only affect future unscored matches
- ✅ Unsaved changes detection
- ✅ Save/Discard workflow

### Technical Details
- Audit entries include:
  - `event_id`: Link to the event
  - `editor_id`: Who made the change
  - `change_type`: Type of modification
  - `changes`: JSONB with before/after diff
  - `reason`: Optional explanation
  - `edited_at`: Timestamp
- Event settings are immediately saved (no pending state currently)
- Future matches automatically use new settings

---

## 🔄 Phase 2: Player Management (NEXT)

### Features to Implement
- [ ] Add player (late join)
  - Show player selector
  - Add to event
  - Regenerate schedule from next round onward
  - Audit entry

- [ ] Mark player inactive (early exit)
  - Mark as inactive in `round_robin_players`
  - Remove from future rounds
  - Rebalance schedule
  - Audit entry

- [ ] Substitute player
  - Single round: Replace in one match only
  - Global: Replace in all future rounds
  - Validation: No duplicates in same round
  - Audit entry

### Database Changes Needed
- None (existing tables support this)

### Components to Create
- `PlayerManagementDialog` - Add/remove/substitute players
- `PlayerSelector` - Searchable player picker

---

## 📋 Phase 3: Courts & Rounds Adjustment

### Features to Implement
- [ ] Increase/decrease courts
  - Update `num_courts` in event
  - Regenerate future rounds with new court count
  - Rebalance matches
  - Audit entry

- [ ] Increase/decrease rounds
  - Update `num_rounds` in event
  - Add rounds: Generate additional rounds
  - Remove rounds: Warn and delete future rounds
  - Audit entry

### Components to Create
- `CourtsRoundsEditor` - Adjust tournament structure

---

## 🎯 Phase 4: Schedule Editing

### Features to Implement
- [ ] Swap partners within match
  - Drag-and-drop or button-based
  - Only affects selected match
  - Validation: Teams must have 2 players each
  - Audit entry

- [ ] Swap opponents across matches
  - Pick two matches in same round
  - Exchange Team A ↔ Team B
  - Audit entry

- [ ] Move match to different court
  - Same round only
  - Validation: Court available
  - Audit entry

- [ ] Lock completed rounds
  - Prevent edits to rounds with scores
  - Visual indicator

### Components to Create
- `ScheduleEditor` - Interactive schedule editing
- `MatchSwapper` - Swap interface

---

## 🔄 Phase 5: Score Editing & Match Management

### Features to Implement
- [ ] Edit saved scores
  - Update scores in `round_robin_schedule`
  - Recalculate standings
  - If rating-eligible: Reflow ratings forward
  - Reset verification (`verified_by`)
  - Audit entry

- [ ] Void match
  - Mark match as voided
  - Keep in schedule with "Voided" badge
  - Remove from standings/ratings
  - Audit entry

- [ ] Delete match (admin only)
  - Remove from schedule
  - Reflow ratings
  - Audit entry

### Database Changes Needed
- Add `voided` column to `round_robin_schedule`

### Components to Create
- `ScoreEditor` - Edit/void/delete scores

---

## 🔔 Phase 6: Realtime & Notifications

### Features to Implement
- [ ] Realtime broadcast
  - Channel: `round_robin_edit_{event_id}`
  - Events: schedule_updated, players_updated, round_opened, round_closed, match_updated
  - Live updates for all participants

- [ ] Player notifications
  - Push/SMS when schedule changes
  - "Your next match changed: Round 3, Court 2"
  - Respect notification preferences

- [ ] Undo functionality
  - Track last save timestamp
  - Allow undo within 5 minutes
  - Revert from audit trail
  - Show "Undo" button after save

- [ ] Audit history viewer
  - Table of all changes
  - Filter by change type
  - Admin view for all events

### Components to Create
- `AuditHistoryDialog` - View change history
- `UndoButton` - Revert recent changes

---

## 🎯 Current Status
**Phase 1 Complete** - Basic edit mode infrastructure is live. Organizers can now edit event settings (name, notes, rating eligibility, match type) with full audit tracking.

**Next Steps**: Proceed to Phase 2 to add player management capabilities.

---

## Testing Checklist

### Phase 1 Tests
- [x] Edit button visible to organizers only
- [x] Edit dialog opens and closes properly
- [x] Name changes persist
- [x] Notes changes persist
- [x] Rating eligible toggle works
- [x] Match type selector works
- [x] Audit entries created correctly
- [x] Non-organizers cannot see edit button
- [x] Voided events cannot be edited

### Future Tests (Phases 2-6)
- [ ] Add player regenerates schedule correctly
- [ ] Inactive player removed from future rounds
- [ ] Substitute validation (no duplicates in round)
- [ ] Court increase rebalances schedule
- [ ] Round decrease shows warning
- [ ] Swap partners maintains doubles format
- [ ] Score edit recalculates standings
- [ ] Void match removes from ratings
- [ ] Realtime updates reach all participants
- [ ] Undo works within time window
- [ ] Audit history shows all changes
