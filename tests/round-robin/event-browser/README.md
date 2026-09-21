# Courtside design preview

This mounts the real RoundRobinDetail route, including its organizer controls, nested dialogs, and PlayerRoundRobinView. Backend and auth imports are replaced with local fixtures. Mutations return a preview error; nothing reaches Supabase or sends invitations.

Command center QA: add `?command` to enable score saves and round advancement **in memory only**. `&saveerror` keeps score saves failing for retry/retention checks. `&manycourts` expands the display fixture to 12 courts (reuses names for layout stress, not a valid generated schedule). `&longnames`, `&rest`, and `&dark` cover name wrapping, the resting-player page, and dark appearance. Reload resets all fixture changes. Start/completion and other backend mutations remain disabled.

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
