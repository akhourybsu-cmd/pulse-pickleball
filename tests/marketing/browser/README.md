# Homepage screenshots and browser QA

The four JPEGs in `public/images/product/` are unedited browser captures of real
PULSE components, rendered at 390 × 844 using synthetic local data. They contain
no customer records and are labeled “Actual PULSE screen · Demo data” on the
homepage. These are screenshots, not interactive app sessions. The homepage's
“View screen” control opens the whole capture for easier reading.

Captured September 23, 2026, from the application at `33774858` plus the local
capture harness in this change. No generated artwork, reconstructed interface,
external image host, or live backend is used.

| Asset | Actual screen | Local source |
| --- | --- | --- |
| `assessment.jpg` | Guest Skill Assessment report | Skill browser harness, `?capture`, completed synthetic answers |
| `profile.jpg` | Player profile | Profile browser harness, `?short-name&member&marketing` |
| `round-robin.jpg` | Player's current court and next rounds | Round-robin event harness, `?player&dark` |
| `league.jpg` | League standings | `PlayerLeagueDetail`, `?league&dark`, Standings button |

## Refresh captures

Start each existing Vite fixture server from the repository root in a separate
terminal. The fixture aliases replace data access, while rendering the same
components used in production:

```sh
node node_modules/vite/bin/vite.js --config tests/skill/browser/vite.config.ts --host 127.0.0.1 --port 5198 --strictPort
node node_modules/vite/bin/vite.js --config tests/round-robin/event-browser/vite.config.ts --host 127.0.0.1 --port 5208 --strictPort
node node_modules/vite/bin/vite.js --config tests/profile/browser/vite.config.ts --host 127.0.0.1 --port 5209 --strictPort
node node_modules/vite/bin/vite.js --config tests/marketing/browser/vite.config.ts --host 127.0.0.1 --port 5210 --strictPort
```

Open `http://127.0.0.1:5210/tests/marketing/browser/capture.html`, select a
screen, and keep the width at 390. Complete the assessment with synthetic
answers first if the local skill harness has no guest report. For leagues,
select Standings before capture. Capture the iframe at x=0, y=0, width=390,
height=844. Save the browser's JPEG bytes directly, without compositing or
altering the screen. Check the file's actual encoding when choosing its suffix.

The `marketing` profile parameter adds a synthetic 47-match, 29–18 record.
League standings use the real production calculation with six synthetic
confirmed matches. Fixture actions are not connected to production.

## Responsive and interaction checks

Select Homepage in the capture harness; check widths 320, 390, 768 and 1440.
The separate `responsive.html` harness can also inspect the full app at its own
origin. The carousel's intentionally clipped offscreen slides should not be
counted as page overflow.

- Check header/logo, first CTA, every image, text wrapping, no page overflow.
- Use arrows and feature buttons; verify disabled arrows at both ends.
- Drag horizontally to change slides; vertical scrolling must still work.
- Focus the carousel and use Left/Right, Home and End.
- Open each enlarged screenshot; Close/Escape must return focus to its opener.
- Check light and dark themes (`?dark` in the homepage fixture), mobile menu,
  native FAQ disclosures, and navigation to assessment/signup destinations.
- With reduced motion enabled, slides should change without animation. There
  is no autoplay; the decorative pulse stops after two cycles.

The homepage unit tests protect public destinations, feature-flag behavior,
accessible initial controls, local image resources, and demo-data labeling.
