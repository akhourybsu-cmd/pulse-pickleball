
# League Management — Desktop Redesign

Frontend-only pass. No schema, no RPCs, no route changes. Business logic in each tab stays untouched — this rebuilds the visual layer and the composition around it.

## Locked design tokens

Apply these verbatim as scoped tokens for `/admin/leagues/:id` and `/player/leagues/:id/manage`. Do not re-derive shades.

- **Palette (Emerald Prestige)**
  - `--lg-bg`: `#04140F` (deep court black-green)
  - `--lg-surface`: `#0A2A20` (card base)
  - `--lg-surface-2`: `#0F3A2C` (raised / hover)
  - `--lg-border`: `#134A38`
  - `--lg-emerald`: `#0D7A5F` (primary action, active state)
  - `--lg-emerald-deep`: `#064E3B` (hero wash, gradient anchor)
  - `--lg-gold`: `#C9A84C` (trophy accent, standings leader, championship)
  - `--lg-gold-soft`: `#F5F0E0` (light-on-dark text on gold chips)
  - `--lg-text`: `#F5F0E0` (primary text on dark)
  - `--lg-text-dim`: `#9CB5A8` (muted labels)
  - Signature gradient: `linear-gradient(135deg, #064E3B 0%, #0D7A5F 55%, #0A2A20 100%)`
  - Every existing `#A6DB5A` / lime chip inside the league surfaces is replaced by emerald or gold — no more Pulse-lime here.

- **Typography**
  - Headings: **Bebas Neue**, uppercase, `tracking-[0.04em]` — h1 `text-5xl`, tab section h2 `text-2xl`, stat numerals `text-4xl`.
  - Body / UI: **Barlow** — 400 default, 600 for row primary text, 700 for CTA labels.
  - Tabular numerals everywhere numbers appear (`font-variant-numeric: tabular-nums`).
  - Fonts loaded once from `index.css` `@import url(...)`; a scoped `.league-admin` class sets `font-family` so the rest of the app is untouched.

- **Elevation & shape**
  - Radius: cards `rounded-xl`, chips/buttons `rounded-md`. No pill shapes.
  - Card: `bg-[--lg-surface] border border-[--lg-border]`, hover raises to `--lg-surface-2` with `shadow-[0_1px_0_0_rgba(201,168,76,0.08)_inset]` (thin gold hairline top).
  - Focus ring: 2px `--lg-gold` at 60% opacity.

- **Motion**
  - Tab-pane crossfade 160ms ease-out (keep existing `AnimatePresence`).
  - Row hover: 90ms background lift only, no translate.
  - "Live" indicator (active session, in-progress match): 1.6s emerald pulse dot.

## Layout — Dashboard console shell

`AdminLeagueDetail.tsx` becomes a three-zone console. The existing `LeagueManageNav` rail stays but is restyled and gets one persistent slot.

```text
┌───────────────────────────────────────────────────────────────────┐
│  HERO BAND  (full-bleed emerald→black gradient, 260px)            │
│  ┌──────────────┬──────────────────────────────────────────────┐  │
│  │ crest / mono │  BEBAS TITLE                       [status]  │  │
│  │  gold rule   │  location · type · visibility                │  │
│  └──────────────┴──────────────────────────────────────────────┘  │
│  KPI STRIP  (4 tiles, tabular, gold underline on the leader)      │
│   Seasons │ Members │ Teams │ Sessions                            │
├──────────┬────────────────────────────────────────────────────────┤
│ RAIL     │  SECTION HEADER (Bebas)  +  contextual action cluster │
│ 220px    │  ──────────────────────────────────────────────────── │
│          │                                                        │
│  ▸ Overview                    WORKSPACE PANEL                    │
│  ▸ Seasons        (tab content — restyled, one panel at a time)   │
│  ▸ Divisions                                                      │
│  ▸ Members                                                        │
│  ▸ Teams                                                          │
│  ▸ Subs                                                           │
│  ▸ Ladder                                                         │
│  ▸ Sessions                                                       │
│  ▸ Matches                                                        │
│  ▸ Standings                                                      │
│  ▸ Audit                                                          │
│  ─────────                                                        │
│  season picker (sticky at rail foot — one global season context) │
└──────────┴────────────────────────────────────────────────────────┘
```

- Hero band uses the signature gradient with a subtle diagonal court-line SVG (2% opacity) as texture. The existing `motion.div` fade-in stays.
- Rail: 220px on `lg+`, collapses to the current horizontal strip on `md-`. Active item gets a 3px gold left bar + emerald surface. Icons stay from `lucide-react`.
- **Season picker moved into the rail foot.** Right now each tab redoes its own season dropdown; a single sticky picker at the rail foot broadcasts season context (via a new `LeagueSeasonContext`) and the individual tab dropdowns collapse into a compact "override" affordance only where a tab genuinely needs a different season.
- Section header row above the workspace panel: Bebas label + hint + right-aligned action cluster (primary CTA gold-outline, secondary ghost). This replaces the many "New season / Add member / Generate week" buttons scattered inside tab bodies.

## Scoped tabs

### 1. Detail hero + tabs shell (`AdminLeagueDetail.tsx`)
- Rebuild the hero band per the layout above. Drop the lime "Rating-eligible" pill styling; use gold outline chip.
- `HeroStat` becomes a "scoreboard tile": Bebas numeral `text-4xl leading-none`, Barlow uppercase label above, 1px gold divider between tiles on `lg+`.
- `StatusPill` restyled: active = emerald fill + gold hairline, draft = slate, archived = muted.
- `LeagueManageNav`: rail styling above; keep tab keys and hint strings so no callsite changes.

### 2. Members / roster tab (`MembersTab.tsx`)
- Full-width **players table** (not cards) with sticky header, zebra `--lg-surface`/`--lg-surface-2`, right-aligned tabular columns.
- Columns: avatar + name, role (manager / player / sub — colored chip), status (active / injured / withdrawn), rating, matches played, joined, row-menu.
- The existing tabbed "Add Member" dialog (Search / Friends / Community / Guests) keeps its logic but the trigger becomes the section-header primary CTA "Add player" in gold outline; bulk add stays as a secondary action.
- Roster count in hero already excludes managers — surface the same rule in a small "N active on roster · M managers" caption under the section header so the number reconciliation is visible.
- Filter row: role toggle group + status toggle group + search — all inline, no dropdowns.

### 3. Seasons + schedule tabs (`SeasonsTab.tsx`, `SessionsTab.tsx`, `DivisionsTab.tsx`)
- **Seasons**: horizontal timeline strip at top (past · current · upcoming), each season a card in emerald surface, current gets gold hairline top border and a live pulse dot. Below the strip, the currently selected season's detail (dates, format, divisions, capacity) as a two-column key/value block instead of the current stacked list.
- **Divisions**: rendered as chips within the season detail card, drag-reorder retained, each chip shows tier number in Bebas + member count.
- **Sessions / schedule**: week grid — vertical list of week rows, each row = date + court count + match count + status + row action. Generate-next-week CTA lives in the section header. The existing `WeekSessionDialog` opens unchanged.
- Court chips use "C1 / C2" nicknames per the existing court-display standard.

### 4. Standings & results tab (`StandingsTab.tsx`, `MatchesTab.tsx`, `LadderTab.tsx`)
- **Standings**: leaderboard table. Rank column in Bebas, top rank gets a gold trophy glyph and gold row hairline. Rating delta as tabular ± with emerald/red. Sparkline column (last 5 results, W/L dots) on `xl+`.
- **Matches**: card list restyled to match the roster table density — one row per match with score cells that visually read like a scoreboard (Bebas numerals, emerald divider between team A / team B). Verification chip: pending = gold outline, verified = emerald fill, disputed = red outline.
- **Ladder tiebreaks**: the existing `MovementBadge` + `MovementLegend` stay (green up / red down / gray flat). Persistent "Tiebreaker needed" banner restyled with gold hairline + emerald surface, keeps its current CTA behavior.

## Files touched (no schema, no logic changes beyond composition)

- `src/index.css` — add `.league-admin` scoped block with `--lg-*` tokens, Bebas / Barlow `@import`, `font-family` scope, focus ring override.
- `src/pages/admin/AdminLeagueDetail.tsx` — hero band + KPI strip rebuild, `HeroStat` / `StatusPill` restyle, wrap surface in `<div className="league-admin">`, mount `LeagueSeasonProvider`.
- `src/components/admin/leagues/LeagueManageNav.tsx` — rail styling, active-state gold bar, season-picker slot at foot.
- `src/components/admin/leagues/LeagueSeasonContext.tsx` — **new**, tiny provider holding the currently selected season; consumed by each tab in place of its local season state (each tab keeps its own hook signature; only the source of the ID changes).
- `src/components/admin/leagues/_shared.tsx` — add `<SectionHeader>`, `<ScoreboardTile>`, `<TableShell>`, `<StatusChip>` primitives so tabs share the same table + header components.
- `src/components/admin/leagues/MembersTab.tsx` — swap card list for `TableShell`, hoist Add / Bulk-Add triggers into `SectionHeader`, add role + status filter toggles. Dialog internals unchanged.
- `src/components/admin/leagues/SeasonsTab.tsx` — timeline strip + key/value detail block.
- `src/components/admin/leagues/DivisionsTab.tsx` — chip-based rendering inside the season card.
- `src/components/admin/leagues/SessionsTab.tsx` — week grid rows; generate-next CTA moves to section header. `WeekSessionDialog` untouched.
- `src/components/admin/leagues/StandingsTab.tsx` — leaderboard table with trophy + sparkline column.
- `src/components/admin/leagues/MatchesTab.tsx` — scoreboard-style row rebuild; verification chips restyle.
- `src/components/admin/leagues/LadderTab.tsx` — banner + tiebreak card restyle only; movement badges + finalize flow logic untouched.

Explicitly not touched: `TeamsTab.tsx`, `SubstitutesTab.tsx`, `AuditLogTab.tsx`, `InviteCodeCard.tsx`, `TeamRosterDialog.tsx` (they inherit the token scope but keep current composition — a separate pass can address them).

## Guardrails

- **No business-logic edits.** Data hooks, RPC signatures, and dialog internals stay identical; only their wrappers and typography change.
- **No changes to the player-facing `PlayerLeagueDetail.tsx`** — that surface has its own memory-tracked design language. This pass affects only `/admin/leagues/:id` and the mirrored `/player/leagues/:id/manage` shell, which share `AdminLeagueDetail.tsx`.
- **Mobile falls back to the current strip layout.** The rail collapses at `< lg`; hero KPI grid keeps the current 2-col mobile behavior.
- **No new dependencies.** Bebas Neue + Barlow via Google Fonts import; everything else uses the existing `lucide-react`, `framer-motion`, Tailwind, shadcn stack.

## Sequencing

1. Land tokens + `.league-admin` scope + hero band + rail restyle (visible baseline).
2. `_shared.tsx` primitives + `LeagueSeasonContext`.
3. Members → Seasons/Divisions → Sessions → Standings → Matches → Ladder banner, in that order — each is a self-contained PR-sized change.
4. Visual QA pass at `1280` and `1600` desktop widths against a live league with data.
