# Homepage screenshots and browser QA

The eight JPEGs in `public/images/product/` capture actual PULSE pages at
390 × 844 with synthetic local data. The page layouts, controls, and navigation
are production components. The capture harness only hides desktop scrollbars
to match a phone; it does not reconstruct or composite the screens. No customer
records, private conversations, live backend, generated artwork, or external
image host is used. The homepage labels every capture “Actual PULSE screen ·
Demo data” and offers a larger view.

Refreshed September 23, 2026, from application base `ba51c9c7` with this local
capture harness. Every screen is captured from the top. The league capture
starts at the league header, not partway through the Standings section.

| Asset | Actual screen | Local source |
| --- | --- | --- |
| `app-home.jpg` | Player dashboard with real shell | `?screen=app-home&dark&capture` |
| `friends.jpg` | Friends list with real shell | `?screen=friends&dark&capture` |
| `chat.jpg` | Direct conversation | `?screen=chat&dark&capture` |
| `communities.jpg` | Community hub with real shell | `?screen=communities&dark&capture` |
| `profile.jpg` | Player profile with real shell | `?screen=profile&dark&capture` |
| `assessment.jpg` | Guest Skill Assessment report | Skill browser harness, `?capture`, completed synthetic answers |
| `round-robin.jpg` | Player's current court and next rounds | Round-robin event harness, `?player&dark&capture` |
| `league.jpg` | League overview and standings | `?league&dark&capture` |

## Refresh captures

Start the existing Vite fixture servers from the repository root in separate
terminals (reuse an already-running server on the same port):

```sh
node node_modules/vite/bin/vite.js --config tests/skill/browser/vite.config.ts --host 127.0.0.1 --port 5198 --strictPort
node node_modules/vite/bin/vite.js --config tests/round-robin/event-browser/vite.config.ts --host 127.0.0.1 --port 5208 --strictPort
node node_modules/vite/bin/vite.js --config tests/marketing/browser/vite.config.ts --host 127.0.0.1 --port 5210 --strictPort
```

Open `http://127.0.0.1:5210/tests/marketing/browser/capture.html`, select a
screen, and keep width 390. Complete the assessment with synthetic answers first
if the local skill harness has no guest report. Dismiss the dashboard's actual
Getting started card if shown, then reload the capture to return to the top.
Wait for fonts, images, and entrance animations to settle. Confirm the logo or
page header is completely visible. Do not scroll to a section before capture.

Use a browser viewport at least 844px tall so the entire phone frame is painted,
including fixed bottom navigation. Capture the iframe at x=0, y=0, width=390,
height=844. Save and review the same captured bytes. Save the browser's JPEG
bytes directly. Do not crop, repaint, or overlay the image. The parent capture
page hides its own overflow so controls outside the iframe do not create white
scrollbar strips in the exported image.

`socialFixture.ts` supplies a synthetic player, friends, three communities and
a five-message conversation. Read queries resolve locally; mutation methods
throw. `leagueFixture.ts` supplies six confirmed matches for the production
standings calculation. Keep these fixtures outside the production build.

## Responsive and interaction checks

Select Homepage; check 320, 390, 768 and 1440 px in light and dark themes.

- The image must retain its 390:844 ratio, with both top and bottom edges
  visible. The View screen control must sit below it without covering content.
- Confirm all eight images load, with no page overflow or clipped feature names.
- Use arrows, feature buttons, and a horizontal drag; verify the end stops.
- Focus the carousel and use Left/Right, Home and End.
- Open enlarged captures; Close/Escape must return focus to the opener.
- Verify mobile menu, assessment and signup destinations remain available.
- Reduced motion removes carousel animation. There is no autoplay.

The homepage unit tests protect public destinations, feature-flag behavior,
accessible controls, image resources and demo-data labeling. Framing and image
legibility are verified in the browser at the four widths above.

## Premium homepage layout (October 8, 2026)

The homepage now presents three independent screenshot galleries: your game
(app home, assessment, profile), your people (friends, chat, communities), and
organized play (round robins, leagues). The assessment feature flag removes
that slide without leaving an empty gallery position. All product captures
retain their complete original proportions and demo labels.

The hero uses a locally hosted photograph by Mason Tuttle:
[original photograph](https://www.pexels.com/photo/paddle-and-ball-on-court-17299528/),
[Pexels license](https://www.pexels.com/license/), checked October 8, 2026.
Source image: `https://images.pexels.com/photos/17299528/pexels-photo-17299528/free-photo-of-paddle-and-ball-on-court.jpeg`.
The 1600px JPEG is 119,066 bytes; the 800px mobile source is 34,323 bytes.
These files live in `public/images/marketing/`; visitors make no image request
to Pexels. Photographer credit is linked in the footer. The photograph is
illustrative court equipment, not a PULSE product screenshot or endorsement.

Motion is progressive enhancement: a brief entrance, three subtle gold pulses,
and section reveals in browsers supporting CSS view timelines. Reduced-motion
preferences disable these effects and the galleries' transitions. There is no
autoplay, mandatory scroll snapping, nested vertical scroller, or scroll handler.
Ordinary touch scrolling and browser zoom remain available.

The marketing Vite fixture also serves `/`, so public anchor navigation can be
checked without accidentally mounting the production app. It carries the real
URL hash into its memory router for section scrolling after the page mounts.

Validation: homepage regressions (11 tests), application TypeScript check,
changed-component ESLint, and production build/backend-artifact guard passed.
Browser checks covered 320/390/768/1024/1440px light layouts and
320/390/768/1440px dark layouts without horizontal overflow. All eight
screenshots loaded at their original aspect ratio. Three independent galleries
passed selection, keyboard Home/End/Right navigation and disabled end controls;
the enlarged assessment dialog returned focus on Escape. The 320px mobile menu
fills its available width; its organizer link closes the menu and positions the
section below the fixed header. Guest assessment and signup CTAs reached the
local fixture destinations. This is presentation/navigation QA, not a new live
account-creation or OAuth test.
