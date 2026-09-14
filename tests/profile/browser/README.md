# Isolated Profile responsive preview

Run from the repository root:

```sh
npm exec vite -- --config tests/profile/browser/vite.config.ts --host 127.0.0.1 --port 8090 --strictPort
```

Open `http://127.0.0.1:8090/tests/profile/browser/index.html`.

This renders the real Profile with fictional long names, large stats, admin links and the optional skill assessment. Supabase, permissions and feature flags are replaced only in this preview config; no backend access is made. This entry is not included in the production build.

Check 280, 320, 360, 375, 390, 414, 430, 480, 768, 844, 1024 and 1280px widths: the page and all menu buttons should stay within the viewport, labels should remain readable, vertical scrolling should work, and desktop should retain two columns. Optional fixture parameters:

- `?completed&large-text`: completed assessment with 125% root text sizing (20px).
- `?member&no-assessment&short-name`: regular member, feature disabled, ordinary name/location.

## September 14 rendered verification

- Confirmed main still points to `721c69f7`; the earlier mobile fix had **not been published**. These changes remain local pending publication approval.
- The actual Profile component was tested in the browser, not just inspected as source. All 12 widths above had document scroll width equal to available viewport width, with no overflowing menu buttons, identity text, location or stats. All 20 controls in the admin/assessment-enabled fixture were within bounds. Desktop retained two columns.
- A remaining narrow-screen presentation issue was found: placing the avatar alongside three stat cells squeezed their labels. Avatar/location now share an identity row and the stats get the full content width.
- The completed-assessment/125%-text case revealed cramped action buttons at 280px. Actions now occupy the full card width, labels wrap, and the level chip is width-constrained. Retested at 280, 320, 390, 430 and 844px: all 21 controls and text stayed in bounds.
- The ordinary member fixture passed 280, 320, 390, 430, 844 and 1280px, with all 14 controls in bounds. At each width, the Windows browser's 15px scrollbar made available content width smaller than the requested viewport; checks used the actual content width.
- Screenshots of the narrow header and the Account/Admin/Sign-out area were inspected. Vertical scrolling reached Sign out normally. No menu destinations or account behavior changed.
- Full suite: 1,137 passed, 32 skipped, 10 todo. Final focused Profile/social suite and production build were rerun after the last presentation refinements. Existing build warnings remain unrelated.
- This verifies browser-rendered responsive layout with fictional data. It does not claim testing every physical phone, installed PWA, or OS text-size setting. No production data, database migration, Android Studio or Google Play change is involved.

September 11 historical checkpoint: 30 Profile/social tests and the production build passed, but browser automation stalled and rendered verification was incomplete. The September 14 checks above replace that limitation.
