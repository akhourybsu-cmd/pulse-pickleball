# League typography and menu pass

## Changes

- Removed the league-only Bebas Neue/Barlow font download and overrides. League
  headings and numbers use PULSE's Sora; body text, controls and inputs use Manrope.
- Replaced the separate emerald workspace theme with the app's cream/ink/gold
  tokens. Green remains available for positive results, not the main chrome.
- Retained original capitalization for league names and section titles; raised
  small labels and hints to readable sizes. Gold actions use contrasting ink text.
- Added `.league-menu` to league dialogs, confirmations and select menus because
  these render through portals outside `.league-scope`. Both surfaces now share
  tokens and fonts without changing unrelated app dialogs.
- Refined the shared editor: restrained ink header, scrollable form body,
  persistent action footer, 44px close control, 16px mobile inputs and safe
  viewport bounds. Creation, joining, scoring and substitute menus inherit the
  same typography and bounds.
- Reworked organizer navigation into a grouped desktop rail and a scrollable
  mobile section drawer with explicit close and active-section indicators.
  Reused the existing format-filtered navigation model and improved labels.
- Added All leagues / Player view navigation; retained season query parameters.
  Section changes now create browser-history entries; invalid hidden sections
  normalize with replace, and reselecting the same section creates no duplicate.
- Connected shared form labels to input/select/radio controls. Radio selections
  support arrows, Home/End, wrapping and a single Tab stop.
- Improved long-name wrapping, player section targets, sticky-section offsets,
  table labels and dark-mode score contrast. Capped standings animation delay.

## Verification

- Full suite: **775 passed**, 32 skipped, 10 todo (60 passing test files).
- Added 16 presentation/keyboard regression tests, including font/token
  contracts, original casing, type-filtered navigation and form associations.
- Production Vite build passed. Existing warnings remain for old Browserslist
  data, an ambiguous duration utility and large/shared chunks.
- Repository-wide TypeScript checking still fails on preexisting unrelated
  errors; the focused output contained no league-file diagnostics.
- Confirmed the dev-only `/__league-preview` route and fixture strings are
  absent from the production bundle.
- Inspected an existing populated production league read-only to establish the
  old typography and menu structure. No live league settings/results changed.
- Browser-checked the real shared components in a synthetic-data local harness:
  desktop and mobile, light and dark themes, 390x844 and 320x568 viewports,
  player standings with a long hyphenated name, drawer selection/dismissal,
  keyboard radio changes and labeled dropdowns.
- At 320x568 the editor bounds measured x=16..304, y=16..552. Inputs were 16px;
  radio/selection/close controls 44px; save/cancel 48px. No horizontal document
  overflow was observed. Form content scrolls independently of the footer.

## Scope / release

This is a presentation and navigation pass, not a new scheduling/scoring audit.
No SQL migration is needed. Backend authorization, scheduling and scoring were
not changed. The installed Android package was not rebuilt. The three existing
Android Gradle-file modifications were preserved.

This pass is included in the league Actions/substitute release; see
`2026-09-08-league-actions-substitutes.md` for deployment verification. Preview:
`http://127.0.0.1:8080/__league-preview` (development-only, synthetic data).
