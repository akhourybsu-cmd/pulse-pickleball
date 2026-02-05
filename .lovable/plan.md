

# Unified Event Discovery: Syncing Tournaments to Find Events

## Problem Summary

The **Find Events** page (`/player/find`) shows "No events found" even though there's an active tournament ("Winter Classic" starting Feb 7, 2026) that should be discoverable.

**Root Cause:** The Find Events page uses `useDiscoverEvents` which queries the `unified_events` table. However, tournaments live in a separate `tournaments_events` table with no sync mechanism to populate `unified_events`.

| Table | Purpose | Current State |
|-------|---------|---------------|
| `unified_events` | Canonical discovery table | Empty (0 rows) |
| `tournaments_events` | Tournament storage | Has 1 active upcoming tournament |
| `round_robin_events` | Round robin storage | Separate from unified system |

---

## Solution Options

### Option A: Database Sync Triggers (Recommended)

Create database triggers that automatically sync tournaments to `unified_events` when:
- A tournament is created/updated
- A tournament's `public_view_enabled` is set to `true`
- A tournament's dates change

**Pros:**
- Single source of truth for discovery
- Automatic, real-time sync
- Works with existing Find Events UI

**Cons:**
- Requires database migration
- Need to handle existing tournaments

### Option B: Modify useDiscoverEvents Hook

Update the hook to query both `unified_events` AND `tournaments_events`, then merge results.

**Pros:**
- No database changes
- Quick to implement

**Cons:**
- More complex client-side logic
- Duplicate queries
- Harder to maintain long-term

---

## Recommended Approach: Database Sync + Backfill

### Step 1: Create Sync Function

Create a PostgreSQL function that maps tournament fields to unified_events format:

```text
tournaments_events → unified_events mapping:
├── name → title
├── description → description  
├── 'tournament' → event_type
├── start_date (as timestamp) → start_time
├── end_date (as timestamp) → end_time
├── venue_id → host_venue_id, venue_id
├── 'venue' → host_type
├── registration_enabled → derives status
├── public_view_enabled → visibility ('public' or 'private')
└── id → legacy_id, 'tournaments_events' → legacy_table
```

### Step 2: Create Database Trigger

A trigger on `tournaments_events` that:
- **INSERT:** Creates corresponding `unified_events` row when `public_view_enabled = true`
- **UPDATE:** Syncs changes to `unified_events` row
- **DELETE:** Removes from `unified_events`

### Step 3: Backfill Existing Tournaments

Run a one-time migration to sync all existing public tournaments to `unified_events`.

### Step 4: Handle Registration Status

Map tournament registration state to unified status:

```text
If registration_enabled AND now() between open/close dates → 'registration_open'
If registration_enabled AND now() < open_date → 'published'  
If registration_enabled AND now() > close_date → 'registration_closed'
If NOT registration_enabled → 'published'
```

---

## Implementation Details

### Migration SQL

**1. Create sync function:**

```sql
CREATE OR REPLACE FUNCTION sync_tournament_to_unified_events()
RETURNS TRIGGER AS $$
DECLARE
  unified_status TEXT;
  unified_visibility TEXT;
BEGIN
  -- Determine visibility
  IF NEW.public_view_enabled THEN
    unified_visibility := 'public';
  ELSE
    unified_visibility := 'private';
  END IF;

  -- Determine status based on registration
  IF NEW.status = 'completed' THEN
    unified_status := 'completed';
  ELSIF NEW.status = 'cancelled' THEN
    unified_status := 'cancelled';
  ELSIF NEW.registration_enabled THEN
    IF NEW.registration_open_date IS NOT NULL AND NOW() < NEW.registration_open_date THEN
      unified_status := 'published';
    ELSIF NEW.registration_close_date IS NOT NULL AND NOW() > NEW.registration_close_date THEN
      unified_status := 'registration_closed';
    ELSE
      unified_status := 'registration_open';
    END IF;
  ELSE
    unified_status := 'published';
  END IF;

  -- Handle INSERT/UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO unified_events (
      id, title, description, event_type, host_type,
      host_venue_id, start_time, end_time, venue_id,
      price, visibility, status, is_published,
      created_by, legacy_table, legacy_id
    ) VALUES (
      NEW.id,
      NEW.name,
      NEW.description,
      'tournament',
      CASE WHEN NEW.venue_id IS NOT NULL THEN 'venue' ELSE 'individual' END,
      NEW.venue_id,
      NEW.start_date::timestamptz,
      NEW.end_date::timestamptz,
      NEW.venue_id,
      NEW.registration_fee,
      unified_visibility,
      unified_status,
      NEW.public_view_enabled,
      NEW.organizer_id,
      'tournaments_events',
      NEW.id
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      host_venue_id = EXCLUDED.host_venue_id,
      venue_id = EXCLUDED.venue_id,
      price = EXCLUDED.price,
      visibility = EXCLUDED.visibility,
      status = EXCLUDED.status,
      is_published = EXCLUDED.is_published,
      updated_at = NOW();
    
    RETURN NEW;
  END IF;

  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    DELETE FROM unified_events WHERE legacy_id = OLD.id AND legacy_table = 'tournaments_events';
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**2. Create trigger:**

```sql
CREATE TRIGGER sync_tournament_unified
AFTER INSERT OR UPDATE OR DELETE ON tournaments_events
FOR EACH ROW
EXECUTE FUNCTION sync_tournament_to_unified_events();
```

**3. Backfill existing tournaments:**

```sql
INSERT INTO unified_events (
  id, title, description, event_type, host_type,
  host_venue_id, start_time, end_time, venue_id,
  price, visibility, status, is_published,
  created_by, legacy_table, legacy_id
)
SELECT 
  t.id,
  t.name,
  t.description,
  'tournament',
  CASE WHEN t.venue_id IS NOT NULL THEN 'venue' ELSE 'individual' END,
  t.venue_id,
  t.start_date::timestamptz,
  t.end_date::timestamptz,
  t.venue_id,
  t.registration_fee,
  CASE WHEN t.public_view_enabled THEN 'public' ELSE 'private' END,
  CASE 
    WHEN t.status = 'completed' THEN 'completed'
    WHEN t.status = 'cancelled' THEN 'cancelled'
    WHEN t.registration_enabled THEN 'registration_open'
    ELSE 'published'
  END,
  t.public_view_enabled,
  t.organizer_id,
  'tournaments_events',
  t.id
FROM tournaments_events t
WHERE t.start_date >= CURRENT_DATE
ON CONFLICT (id) DO NOTHING;
```

---

## File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| Create | Database migration | Sync function, trigger, and backfill |
| Modify | `src/pages/player/FindEvents.tsx` | Update navigation for tournaments to use correct route |

### Navigation Fix

Currently the FindEvents component navigates to `/tournaments/${id}` but should use `/tournament/${id}` (singular) for the tournament landing page:

```typescript
// Current (line 196-197)
} else if (event.event_type === 'tournament') {
  navigate(`/tournaments/${event.id}`);

// Should be
} else if (event.event_type === 'tournament') {
  navigate(`/tournament/${event.id}`);
```

---

## Expected Outcome

After implementation:
1. "Winter Classic" tournament will appear in Find Events
2. New tournaments automatically sync when `public_view_enabled = true`
3. Tournament updates reflect in real-time on Find Events
4. Players can discover and click through to tournament details

---

## Future Consideration

The same sync pattern should be applied to:
- `round_robin_events` → `unified_events`
- `calendar_events` (open play, lessons) → `unified_events`

This would complete the Canonical Event System architecture.

