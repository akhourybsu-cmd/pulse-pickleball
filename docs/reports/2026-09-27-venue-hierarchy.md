# Venue hierarchy refinement · 2026-09-27

Implemented the mobile-first refinement in the existing venue flow.

- Five main destinations on mobile and desktop: Overview, Play, Community, Events, About. Reservations remain under Play; chat remains under Community.
- Fixed mobile header: 56 px identity row and 48 px navigation, 36 px logo, thin accent underline. All five tabs fit at 320 px.
- Shared ivory/white/charcoal surfaces, 20 px mobile content gutters, quieter borders, 44 px minimum controls. Venue primary actions, secondary artwork, accent highlights and independent logo matte remain configurable. Legacy surface color fields are retained in storage but no longer override PULSE reading surfaces or appear as editable controls.
- Overview uses a compact identity card overlapping the banner, grouped Join Open Play / View schedule actions and a compact upcoming empty state.
- Play contains daily open play, clinics and practice, plus reservations and linked leagues. Calendar cells use consistent sizing and a native date jump form.
- Events queries future/live top-level venue round robins, socials and special events, plus active leagues linked to the venue community. Daily play formats are excluded. Existing RLS and program registration remain authoritative.
- Managers get a small Add action. Players get no management CTA.
- Community has Feed / Players / Chat, smaller feed filters and one bottom composer. Existing structured looking-for-players, announcement and poll posts are retained.
- Venue info groups identical adjacent hours, displays only saved amenities and exposes bookings, files/policies and notifications directly.
- Day/category/section selections survive through URL state. Mobile scroll memory is scoped by viewer, venue, tab and subsection and restores on remount.

Validation:
- Venue suite: 500 tests passed across 43 files.
- ESLint passed for updated production components.
- Vite development-mode app build passed.
- TypeScript still reports the same 14 pre-existing errors outside this change (tournament schema types, chat RPC/realtime typing, round-robin capacity, dashboard profile and PlayerTabsPreview setters); no errors in the changed venue files.
- Local browser checks: 390 px populated screens, 320 px dark/empty/player/long-name variant, and 1440 px desktop; one composer opens its sheet; calendar jump to October 25 survives leaving and returning to Play; reservations retain the Play tab.
- A local shell-remount fixture verified Players returns to its exact 1623 px scroll offset after visiting a profile.

Scope and limits:
- No production data was written, no migration applied and no deployment made.
- Standalone tournaments remain behind the existing disabled/admin-only feature gate. Events uses the supported competitions instead of linking players to an unavailable tournament route.
- Event list reads up to the next 100 venue occasions. League cards link to real league detail pages without inventing season dates or availability.
- Preview fixtures are fictional and block external writes; authenticated production data was not exercised.
