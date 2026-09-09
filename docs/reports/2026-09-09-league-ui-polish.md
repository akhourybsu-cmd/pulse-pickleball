# League UI refinement — September 9, 2026

## Scope

Web app design and presentation only. Preserve the existing league sections,
navigation destinations, access checks, scheduling, score submission, standings
calculations, and substitution rules. No database migration is needed.

User preference going forward: a general request to update PULSE does **not**
authorize Android Studio, native Android files, Android builds, or Google Play
releases. Those require an explicit Android request. None were touched here.

## Improvements

- Compact desktop manager navigation, with the selected section's description
  visible and all other descriptions still accessible. Mobile retains the full
  descriptive section picker. Pending action counts reuse already-loaded data.
- Quiet all-caught-up state instead of a gold warning for zero pending actions.
  Substitute requests have clearer hierarchy, separated player notes, readable
  counts, and person-specific review button names.
- Standings use a semantic table with row/column headers, a short statistic
  legend, explicit You / Your team markers, and readable recent-form labels.
  Advanced columns respond to the table's actual available width, rather than
  assuming the viewport equals the manager workspace width. Row order and
  all precomputed results are unchanged.
- Player scorecards align each score beside its own full-width player/team row.
  Long names and substitute badges retain their space. Zero scores remain
  visible; incomplete results show Not scored instead of invented numbers.
- Shared form sections use quieter headings and clearer spacing. Input/select
  help text is linked to its control, preserving existing descriptions.
  Saving uses a disabled, busy button with no label-width/layout shift.
- Season selectors, empty-state actions, and nested menu options have readable
  typography and touch-sized controls. Scrollable menus use subtle scrollbars.
- League cards no longer truncate titles or fade archived names; season/location
  metadata wraps. Tiny uppercase role labels are replaced with readable labels.
- Player court summaries use larger labels and calmer number styling. Shared
  heroes allow long season names room on phones without changing numeric KPI
  layouts. Loading states have stable footprints and screen-reader status text.
- League hero/list entrances respect reduced-motion preferences. Standings no
  longer reanimate every row on mount. No dependencies or backend calls added.

## Verification

- Full test suite: **831 passed**, 32 skipped, 10 todo; 64 passing test files.
- 10 new presentation tests cover semantic standings, result/order preservation,
  identity markers, form history, zero/incomplete scores, linked field hints,
  navigation, loading announcements, and empty-state target sizing.
- Final web production build passed in 28.48 seconds. Existing large-chunk,
  shared-import, Browserslist, and ambiguous-duration warnings remain.
- The TypeScript check reported no diagnostics in the changed league files.
  Repository-wide checking remains blocked by unrelated existing type errors,
  including AdminVenueTab profile/theme data typing; this is not a clean global
  TypeScript check.
- Browser checks used actual shared components with synthetic preview data at
  1280x900, 768x1024, 390x844, and 320x568, in light and dark themes.
- No horizontal document overflow observed. At 320px, the editor remained
  x=16, y=16, width=288, height=536; inputs rendered at 16px. Nested selection
  options measured 44px high. The drawer stayed within the viewport.
- Arrow-key radio selection and Escape dismissal were verified. During saving,
  the primary button retained exactly the same 254x48 bounds and exposed
  aria-busy plus disabled state.
- No browser warnings/errors in the test tab. The original light theme and
  normal viewport were restored. No live league records were changed.

## Pre-publication state

The implementation pass finished with locally validated changes awaiting publication.
The subsequent web-only release uses the existing main-branch Firebase workflow,
which repeats the automated tests and production build before deploying.
No SQL, Android build, Android Studio action, or Google Play upload is required
for these web changes. Preview-only fixture data is excluded from production.
