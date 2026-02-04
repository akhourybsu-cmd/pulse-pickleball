

# Fix: Enable Public View for Winter Classic Tournament

## Root Cause

The tournament landing page requires **two conditions** to be met:

| Condition | Table | Current Value | Required |
|-----------|-------|---------------|----------|
| `public_view_enabled` | `tournaments_events` | `false` ❌ | `true` |
| `is_published` | `tournament_customization` | `true` ✅ | `true` |

The query in `TournamentLanding.tsx` filters on `.eq("public_view_enabled", true)`, so the tournament is not found even though customization exists.

---

## Fix

Update the `tournaments_events` table to enable public view:

```sql
UPDATE tournaments_events 
SET public_view_enabled = true 
WHERE id = '6f2726f4-c3c7-47d7-9961-f029f5b3a758';
```

---

## After the Fix

The tournament will be accessible at both URLs:
- `/tournament/6f2726f4-c3c7-47d7-9961-f029f5b3a758` (by ID)
- `/tournament/winter-classic-2026` (by slug)

---

## Technical Note

This is a single database update - no code changes required. The existing page components will work correctly once the flag is enabled.

