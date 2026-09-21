# Round Robin visual release and courtside preview

## Published creation studio

The user approved publishing the 23-file creation release to the existing public repository and Firebase site. PR [138](https://github.com/akhourybsu-cmd/pulse-pickleball/pull/138) merged as `4473f5d4e4009480358ec5764999d949dad564db` after [CI passed](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/35646582526).

[Firebase deployment 35646959742](https://github.com/akhourybsu-cmd/pulse-pickleball/actions/runs/35646959742) completed successfully. A public read of `https://pulsepb.com` returned HTTP 200 with `/assets/index-P0HRg2mN.js`, matching the isolated release build. Its `CreateRoundRobin-Dbw2ApiG.js` bundle contains the event studio, new heading and step navigation.

Publication used `codex/round-robin-event-studio` in the sibling `pulse-round-robin-release` checkout, based on the previous production main. Unrelated venue/reservation changes were excluded. No database or native-app deployment was performed.

## Organizer and player presentation

This release carries the creation studio's visual language into organizer controls and the player view:

- Full-width event identity and responsive host workspace, with sidebars adapting to available room and court columns based on the workspace width.
- A labeled Controls button, larger grouped menus, wider desktop dialogs, mobile drawers with explicit close buttons, and a consistent player picker.
- Shared visible Radix tabs for Schedule, Players and Standings, with keyboard navigation and restrained motion.
- Player court/team/opponent briefing, highlighted assignment, clearer live/voided states, and compact mobile standings.
- Accessible score-field names and a carousel focus-scroll fix; inactive rounds cannot receive keyboard focus.

All event handlers, scheduler and standings calculations, permissions, backend calls and subscriptions remain in place. Personal briefing content derives from the loaded schedule and roster only. Empty and completed player states are covered.

Verification: 16 Round Robin suites / 165 tests passed; production builds passed; edited components introduce no TypeScript errors. Clean components pass focused ESLint; baseline comparison found no additional lint messages in the existing large route/player/audit files. The wider project retains existing TypeScript and lint debt. See `tests/round-robin/event-browser/README.md` for browser checks and their limits.

Preview service: port 5183, `tests/round-robin/event-browser/vite.config.ts`, local fixtures only. The creation preview remains on port 5182.

The user requested publication after reviewing the organizer and player previews. The 20-file release is isolated in `pulse-round-robin-controls-release` on `codex/round-robin-courtside-design`, based on production commit `4473f5d4`. It includes presentation components, the fixture browser harness and this report. Unrelated venue and reservation changes remain in the original checkout. No database, backend configuration or native-app changes are included.

The isolated release passed the full regression suite: 102 test files passed, 3 skipped; 1,271 tests passed, 32 skipped and 10 TODO. The initial sandboxed runner stalled; rerunning with worker-process permissions completed successfully in 69 seconds. The checkout used committed LF line endings, so the schedule persistence contract assertions passed without any SQL edits.

The isolated production build passed in 42 seconds. Its entry asset is `index-XZJE4Cbm.js`, with `RoundRobinDetail-f4v_c9ZO.js` and stylesheet `index-D0v3F8Mc.css`. Existing bundle-size and mixed-import warnings remain.
