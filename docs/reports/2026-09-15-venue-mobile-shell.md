# Venue mobile navigation consistency

Status: implemented locally; not committed, pushed or deployed. Includes the previously pending compact desktop hero work. Web/PWA only; no Android Studio or Google Play changes, SQL migrations, payment operations or live venue data writes.

## Changes

- Mobile venue pages share one visible-viewport frame, a compact branded header and persistent horizontal navigation. Overview content no longer determines the navigation's vertical position.
- Overview, Book (when available), Play, Community, Events and About keep the same header and navigation. Chat remains within Community without replacing the whole page.
- Visited mobile panels stay mounted, retain their own scroll position, and hide inactive content from interaction. Unvisited chat is not eagerly mounted. Desktop retains its separate layout and existing lazy-mount behavior.
- The shared frame follows VisualViewport height/offset, including when the available viewport shrinks. The post composer occupies layout space below content instead of covering it. Long venue names cannot push its buttons outside the viewport.
- Staff controls remain permission-gated in the venue menu. Community tools return to the venue. Free venue communities get a compact, stationary mobile header; the banner moves into their feed and verified status/tagline remain available in About.
- Management descriptions move below the navigation. The toolbar stays visible while content scrolls; a new settings section starts at its beginning. Operations uses the matching mobile charcoal toolbar.
- The existing 1.5-second venue entrance and all payment, access, booking and chat business rules are unchanged.

## Verification

- Full regression suite: 100 files passed; 1,258 tests passed, 32 skipped, 10 todo. After the final composer-width and management-scroll refinements, all 34 focused shell/club/image tests passed again.
- Production web build: passed, 4,720 modules.
- Browser QA used the isolated local fixture at port 8092; Supabase/auth/payment calls are stubbed. It did not modify production data.
- Overview/Book/Play/Community/Events/About tested at 280, 320, 390, 430, 768 and 1023px: header y=0, navigation y=56, exactly one visible panel, no page or panel horizontal overflow. Content transition animation does not affect the header/nav.
- At 320px with 20px root text, a long unbroken venue name and dark mode, all sections remained within bounds. Header/nav scaled together (nav y=70). The discovered oversized composer and rem/pixel gutter mismatch were fixed and rechecked.
- Overview scroll restored to 789px after visiting Book. A local chat draft survived Community → chat → Community → chat. At a 390×480 viewport, the header remained y=0, nav y=56, and the input bottom was 468px, within the visible frame.
- Player-mode venue menu exposed public actions without Manage venue. Management with long names/large text kept nav y=70 through wrapped descriptions and content scrolling; changing sections reset content scroll to zero.
- Desktop checks at 1024, 1440 and 1920px kept one visible panel and no mobile frame; cover height remained 96–112px with no horizontal page overflow.
- Targeted production-file lint passed except two pre-existing `any` errors in GroupDetail (confirmed in HEAD). The preview entry has existing Fast Refresh export warnings.
- Project-wide TypeScript checking still reports 14 errors in unchanged tournament, chat/realtime, round-robin, dashboard and player-preview code. No diagnostics reference changed files. This is not a claim of a globally clean typecheck.

## Remaining verification

An actual installed phone/PWA keyboard and safe-area check is still recommended after publishing. Browser viewport reduction verifies the frame geometry, not OS keyboard behavior or live messaging delivery. Free-community and operations styling changes were source-reviewed; authenticated full-route checks were not performed in this pass.
