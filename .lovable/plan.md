## Goal

In Match History, bundle every match that came from the same Round Robin event into a single collapsible card so the player can immediately see "these 5 matches all came from Pickleball Palace RR — Wed Jun 17" instead of a flat scrolling list of individual cards.

Non-RR matches (pickup matches, tournament matches, manually recorded matches) continue to render as standalone cards exactly like today.

## Behavior

- An RR-grouped card shows, collapsed by default:
  - Event name (e.g. "Test 1")
  - Event date
  - Match count + W-L record from the player's perspective (e.g. "5 matches · 3-2")
  - Net rating change across the group (e.g. "+24")
  - Chevron to expand
- Expanded: the existing `PremiumMatchCard` for each match in the group, ordered by round / court, with the standard RR badge "R{round} · Court {court}".
- Standalone (non-RR) matches render unchanged.
- Sort order of the overall list is preserved: each group sorts by the most-recent match inside it; standalone matches sort by their own date. Same DESC-by-date behavior as today.
- Applies to the **Verified** / **All** lists. Pending matches stay flat (they're already in their own action-required sections and grouping there would hide the CTA).
- Viewing another player's history (`?player=...`) gets the same grouping.

## Visual

- Reuse existing rounded-2xl border-2 Card styling for consistency.
- Header row: trophy/grid icon, event title, small muted date, right side shows W-L pill + net rating delta (green/red), chevron.
- Use `framer-motion` height animation on expand (same easing as existing entrance animation).
- Inside, matches render with reduced top padding so the group reads as one unit.

## Technical details

**Data linkage.** `matches.event_id` is unreliable for RR matches (the RR pipeline does not set it — see comment in `delete_round_robin_event`). The authoritative link is `round_robin_schedule.match_id → matches.id`, and `round_robin_schedule.event_id → round_robin_events.id`.

**Fetch (in `MatchHistory.tsx`, `fetchMatches`).**
After `matchesWithDetails` is built, do one batched lookup:

```ts
const rrCandidateIds = matchesWithDetails
  .filter(m => m.source === 'round_robin')      // already selected
  .map(m => m.match_id);

const { data: rrLinks } = await supabase
  .from('round_robin_schedule')
  .select('match_id, event_id, round_robin_events!inner(id, name, event_date, status)')
  .in('match_id', rrCandidateIds);
```

Build `matchIdToEvent: Map<matchId, { eventId, name, eventDate, status }>`. Attach `rr_event_id`, `rr_event_name`, `rr_event_date` to each `Match`. Extend the `Match` interface accordingly (optional fields).

**Grouping (pure, in render).**
Walk the already-sorted `matches` array and fold consecutive-or-not RR matches by `rr_event_id` into group objects; non-RR matches become singleton entries. Then sort the resulting list of `(group | singleton)` items by their representative date DESC so RR groups land at the date of their most-recent match.

```text
items: Array<
  | { kind: 'single'; match: Match }
  | { kind: 'rr_group'; eventId: string; name: string; date: string;
      matches: Match[]; wins: number; losses: number; netRating: number }
>
```

**New component.** `src/components/matches/RoundRobinMatchGroup.tsx`
- Props: the group object + the same `onVerify` / `onReport` / `playerName` / `playerId` plumbing that `PremiumMatchCard` already needs.
- Internal `useState` for `expanded` (default `false`).
- Uses shadcn `Collapsible` (already in the project) + `ChevronDown` rotation.
- Inside, maps over `group.matches` and renders the existing `PremiumMatchCard` unchanged.

**Render site (`MatchHistory.tsx` ~line 838).**
Replace the current `matches.map(...) → PremiumMatchCard` block with `items.map(...)` that switches on `kind` and renders either `PremiumMatchCard` (single) or `RoundRobinMatchGroup` (group). All wiring (verify dialog, report sheet) is passed through identically.

**Out of scope.**
- No DB migrations.
- No changes to pending-match grouping.
- No changes to `PremiumMatchCard` itself.
- No changes to RR detail pages or the score pipeline.

## Files touched

- `src/pages/MatchHistory.tsx` — extend `Match` interface, add RR lookup in `fetchMatches`, build `items`, swap the render loop.
- `src/components/matches/RoundRobinMatchGroup.tsx` — new collapsible group card.
