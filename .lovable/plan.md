# Final Leaderboard Celebration — Kiosk

When the Round Robin event reaches `status === "completed"`, the kiosk should switch from the live broadcast layout to a dedicated full-screen "Champions" view that feels celebratory and reads from across the room.

## Scope
Single file: `src/pages/RoundRobinKiosk.tsx`. Pure presentation — no schema or data-flow changes. Existing leaderboard calculation (wins / point differential) is reused.

## Trigger
- Currently when `eventData.status === "completed"` the kiosk just fires a toast and keeps rendering the live layout.
- Replace that behavior: keep the data loaded, remove the toast redirect, and render a new `<FinalLeaderboardScreen />` instead of the live broadcast grid when `event.status === "completed"`.
- Header (PULSE logo / clock) and hover admin controls (theme, fullscreen, exit) remain so the host can still exit/fullscreen.
- Bottom ticker is hidden on the final screen (replaced by a celebratory footer line).

## Final Leaderboard layout (16:9, no scroll)
```text
┌──────────────────────────────────────────────────────────┐
│   PULSE logo            EVENT COMPLETE · [Event Name]    │   clock
│                                                          │
│                    🏆  CHAMPIONS  🏆                     │   display font, gold
│                                                          │
│        ┌────────┐                                        │
│        │   1    │   Player Name        12 W · +34        │   center, huge
│        │  GOLD  │                                        │
│        └────────┘                                        │
│  ┌────────┐                       ┌────────┐             │
│  │   2    │ Player Name  10·+18   │   3    │ Name 9·+12  │
│  │ SILVER │                       │ BRONZE │             │
│  └────────┘                       └────────┘             │
│                                                          │
│   4. Name   8W  +6     5. Name 7W +4    6. Name 6W +2    │   compact rows
│   7. ...                                                 │
│                                                          │
│        Thanks for playing · Powered by PULSE             │
└──────────────────────────────────────────────────────────┘
```

### Visual treatment
- Background: existing theme `bg` with a soft radial gold/primary glow behind the podium (CSS radial-gradient, no new assets).
- Podium tiles: 1st centered and tallest, 2nd left, 3rd right. Medal colors via inline style:
  - Gold `#F5C542`, Silver `#C7CDD4`, Bronze `#C97A3A` (kiosk page already uses inline theme colors, so this matches the existing pattern — no global token changes needed).
- Typography: rank number in display font at ~12vw for #1, ~8vw for #2/#3, player names ~4vw, stats ~2vw. All sized in `vw` to stay no-scroll like the rest of the kiosk.
- Remaining players (4 → up to 10) shown as a single horizontal row of compact pill cards beneath the podium; collapse to 2-row grid if more than 6 remain.
- Subtle entrance animation using existing Tailwind utilities (`animate-in fade-in zoom-in-50`, staggered via `style={{ animationDelay }}`). Champion card gets a slow pulse ring (`animate-pulse` on an absolutely-positioned ring div). No new dependencies.
- Confetti: lightweight CSS-only — ~30 absolutely positioned `<span>`s with randomized `left`, `animationDelay`, `backgroundColor` from the theme palette, falling via a keyframe defined inline with a `<style>` tag scoped in the component (matches existing inline-style approach in this file). No npm install.

### Tie / edge cases
- If fewer than 3 players have results, render only the available podium slots and skip the runners-up row.
- If leaderboard is empty (event completed with no scored matches), show a calm "Event Complete" card with the event name and no podium.
- "Champion" label uses the top entry's display name from the existing leaderboard array — no extra fetches.

## Implementation notes (technical)
- Remove the `toast.info("This event has been completed")` + early return in the realtime/event-load handler around line 286 so completed events still render.
- Add `const isComplete = event.status === "completed";` near the existing render branches (around line 424 where `draft` is handled).
- Early-return a new `<FinalLeaderboardScreen leaderboard={leaderboard} event={event} themeColors={themeColors} onExit={...} onToggleFullscreen={...} />` before the live broadcast JSX when `isComplete`.
- Define `FinalLeaderboardScreen` as a local component at the bottom of the same file to keep the change contained.
- Reuse the existing `leaderboard` array already computed for the live sidebar (sorted by wins then point diff). No new calculation.
- Keep auto-refresh subscriptions active so the screen appears the instant status flips to completed without a reload.

## Out of scope
- No changes to how an event gets marked complete.
- No new routes, no DB changes, no edits to `VenueRoundRobinKiosk.tsx` (that page wraps this one).
- No sound effects.
