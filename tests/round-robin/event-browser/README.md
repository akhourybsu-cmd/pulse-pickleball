# Courtside design preview

This mounts the real RoundRobinDetail route, including its organizer controls, nested dialogs, and PlayerRoundRobinView. Backend and auth imports are replaced with local fixtures. Mutations return a preview error; nothing reaches Supabase or sends invitations.

Command center QA: add `?command` to enable score saves and round advancement **in memory only**. `&saveerror` keeps score saves failing for retry/retention checks. `&manycourts` expands the display fixture to 12 courts (reuses names for layout stress, not a valid generated schedule). `&longnames`, `&rest`, and `&dark` cover name wrapping, the resting-player page, and dark appearance. Reload resets all fixture changes. Event completion is also simulated with `?command`; other backend mutations remain disabled.

```powershell
node node_modules/vite/bin/vite.js --config tests/round-robin/event-browser/vite.config.ts --host 127.0.0.1 --port 5183 --strictPort
```

Open `/tests/round-robin/event-browser/index.html`. Query options:

- `?player`: player view; default is organizer.
- `?draft&empty`: event before a schedule exists.
- `?completed`: completed event and standings.
- `?voided`: voided state.
- `?dark`: dark theme. Options may be combined.

Checked September 21, 2026:

- Desktop host and player layouts; phone layouts at 390px and 320px; 768px tablet player layout and dark theme.
- Host Settings to Courts & Games; manual schedule editor protected round, editable round and Move court submenu, then Back/Close.
- Manage Players to Add Player to player-source picker, then Done/Cancel. No roster change submitted.
- Score corrections and activity log at 320px. Fixed the score dialog's implicit grid minimum width to prevent horizontal scrolling.
- Visible Radix tabs respond to arrow-key navigation. Player standings fit at 320px; player draft/empty and completed states display correctly.
- Score fields preserve entered values. Fixed a browser focus-scroll issue by clipping the carousel viewport; after focusing both team inputs its scrollLeft remains zero and the active slide aligns with the viewport. Inactive slides are inert and hidden from assistive navigation.
- No application console errors; existing React Router future-version warnings occur in this local harness.

The fixture checks presentation and navigation. It does not validate production event writes, sharing, invitations, rating recalculation, or realtime delivery.

Data-tab checks (October 7, 2026): `noscores`, `departed`, `waitlist`, `sparse`, and `removedresult` exercise empty rankings, a former participant, an inactive waitlist entry, saved rounds 1/4/7, and a voided match result. `departed` changes roster status only, intentionally leaving the old assignments visible for historical-display checks; it does not simulate a schedule adjustment.

- Host and player final standings matched row for row, including former-player records without ranks.
- At 320px, roster search, wrapping names, standings statistics, and organizer schedule controls fit without horizontal page overflow; light and dark appearances checked.
- Unscored players received no rank; waitlisted players did not inflate the active count or enter standings; voided events showed historical results without rankings.
- Saving a simulated 11–2 score updated the schedule summary, player record, and standings consistently. Player search survived switching tabs.
- The round chooser reached saved rounds 1, 4, and 7; grouped rest seats were deduplicated and shown separately from court matches.

Performance checks (October 3): `?large&perf&command&latency=150` uses a valid 32-player, eight-court, 20-round mixed schedule. `?large&perf&player&latency=150` measures the participant view. The local panel counts read requests, mounted round groups, and React render time. Ready time begins when the fixture mounts (after module loading and fixture generation). Reset measurements before typing both scores or cycling the tabs. Interaction render time is React CPU work, not wall-clock latency. `?player&simulate` exposes a local realtime round-advance control. No data leaves this fixture.
# Command center and public kiosk checks

Add `?kiosk` to mount the actual public display against the isolated backend. It supports the same `large`, `longnames`, `rest`, `scored`, `noscores`, `departed`, `completed`, `voided`, and `sparse` scenarios as the event fixture. `simulate` adds controls to advance the fixture round, interrupt/restore reads, or hide the event; these never contact production.

Check large and compact broadcast sizes plus a 320px phone: every court and ranked player must be reachable through pages, manual navigation pauses cycling, themes persist, and exit confirmation returns to the event. Empty completed events must not award a podium. A failed refresh retains the last snapshot with a warning on live and final screens; a hidden event clears it.

For the host, `?command&slow&retry&rest` exercises saving, synchronous pending locks, failed-save draft retention, retry, resting seats, advancing, and completion. `completed&removedresult` verifies a removed score never highlights a winner. `sparse` verifies browsing saved rounds while unsafe advancement stays disabled.
