# Unified League Design System

Bring `PlayerLeagues`, `PlayerLeagueDetail`, and `AdminLeagueDetail` under one visual language so a player and an organizer feel like they're inside the same product — from the league list, through the detail page, into the management console.

## Direction

Adopt **Emerald Prestige** (the admin theme you already approved) as the single league identity. The admin surface stays visually anchored; the player pages get retrofitted to match. Both surfaces render correctly in **light and dark app themes**.

- Colors: emerald `#0D7A5F` + deep `#064E3B`, gold accent `#C9A84C`, cream text `#F5F0E0` on dark / navy ink `#0A2A20` on light.
- Type: Bebas Neue for page titles + big numerals; Barlow (semibold) for nav, chips, and body labels; Inter stays for long-form paragraphs.
- Motifs: gold hairline separators, diagonal court-line texture on heroes, scoreboard-style KPI blocks.

## Scope

### 1. Promote `.league-admin` → `.league-scope` (shared token layer)
`src/index.css`
- Rename the scope from `.league-admin` to `.league-scope`. Keep every token (`--lg-*`) and helper class (`.lg-card`, `.lg-hero-gradient`, `.lg-court-lines`, `.lg-num`, `.font-display`).
- Add a **light-mode variant**: `.league-scope.league-scope--light` swaps `--background`, `--card`, `--foreground`, `--border`, `--muted-foreground` to a cream-on-emerald-ink palette (bg `#F5F0E0`, card `#FFFFFF`, ink `#0A2A20`, border `hsl(165 30% 82%)`, muted `hsl(165 20% 40%)`). Emerald + gold accents unchanged so brand reads the same.
- Player pages: use the light variant when the app is in light mode, dark variant when dark. Admin can stay dark-locked (organizer console reads best on dark) OR follow theme — I'll follow theme for consistency.
- Detect theme via `next-themes` `useTheme()` and toggle the modifier class on the outer wrapper.

### 2. Rebuild `PlayerLeagues` hero + cards
`src/pages/player/PlayerLeagues.tsx`
- Wrap the page in `<div className="league-scope ...">`.
- Hero: replace the navy `#0B171F` gradient with `.lg-hero-gradient` + `.lg-court-lines`. Eyebrow chip becomes emerald/gold. Title uses `.font-display` (Bebas). "My Leagues" reads as a scoreboard title.
- Primary CTA (Create): swap PULSE-green button for `.lg-btn-primary` — emerald fill, gold hover ring. Secondary (Join): outline with gold border.
- League row cards: replace `bg-card` + `meta.stripe` colored bars with `.lg-card` (emerald surface, gold inset hairline). The league-type stripe becomes a thin gold left-bar for the league you own/manage, emerald for player-role. Type label uses Barlow uppercase tracking.
- Discover section: same card treatment, slightly desaturated (`.lg-card` with 60% opacity).

### 3. Rebuild `PlayerLeagueDetail` to mirror admin
`src/pages/player/PlayerLeagueDetail.tsx`
- Wrap in `.league-scope`.
- Hero: same `.lg-hero-gradient` + `.lg-court-lines` + gold hairline used on admin. Reuse the exact meta chip / status pill treatment. Add a **"Managed by {name}"** row (already exists on admin — pull it here too) so players know who's running the league.
- Add a **player-scoped KPI strip** below hero title: `Season` · `Your record` · `Position` (ladder) or `Standing` (others) · `Upcoming`. Same `HeroStat` component visual (Bebas numeral over gold uppercase label).
- Section headers: switch from lowercase `text-muted-foreground` to gold uppercase Barlow tracking labels with a gold underline hairline (matches admin's tab header treatment).
- Match rows + standings tables: emerald borders, gold accent on winners, `.lg-num` for scores.

### 4. Small shared primitives
`src/components/leagues/_shared.tsx` (new — mirror of `admin/leagues/_shared.tsx`, or move the shared bits up)
- Extract `LeagueHero`, `LeagueHeroStat`, `LeagueSectionHeader`, `LeagueMetaChip`, `StatusPill` from admin so both player + admin call the same component. This is the mechanism that keeps them cohesive over time — one component, one look.

### 5. Admin console adjustments
`src/pages/admin/AdminLeagueDetail.tsx`
- Rename class from `league-admin` → `league-scope`. Update all references in `_shared.tsx`, `LeagueManageNav.tsx`, `index.css`.
- Consume the extracted `LeagueHero` primitive so admin stops carrying a duplicate implementation.

### 6. Light-mode contrast pass
For every `.lg-*` helper and every custom color used in components:
- Verify text-on-emerald and text-on-cream pairs hit WCAG AA (4.5:1 for body, 3:1 for large).
- Gold `#C9A84C` on cream `#F5F0E0` fails contrast — use gold only on dark surfaces; on light surfaces switch the eyebrow to `--lg-emerald-deep` `#064E3B` on cream, keeping gold reserved for accent hairlines/icons.
- Muted text on light: use `hsl(165 20% 35%)` (not the dim cream token, which is dark-mode only).

## Non-goals

- No changes to league business logic, RPCs, or data flow.
- No changes to tab bodies (Members/Ladder/Matches/etc.) beyond inheriting the new tokens — those already live inside `.league-admin` so the rename picks them up for free.
- Not restyling `JoinLeagueByCode` public teaser or `CreateLeagueDialog` in this pass (can follow up).

## Technical notes

```text
league-scope (shared class, token layer)
├── .lg-hero-gradient    ─ emerald→deep radial + gold sheen
├── .lg-court-lines      ─ 45° cream hairlines @ 6% opacity
├── .lg-card             ─ surface + gold inset shadow + emerald border
├── .lg-num              ─ Bebas Neue tabular
├── .font-display        ─ Bebas Neue uppercase
└── .league-scope--light ─ light mode token overrides (cream bg, ink text)

Consumers:
├─ PlayerLeagues.tsx           (list + discover)
├─ PlayerLeagueDetail.tsx      (player view of one league)
├─ AdminLeagueDetail.tsx       (organizer console) — already consumes it
└─ components/leagues/_shared  (LeagueHero, HeroStat, SectionHeader, StatusPill)
```

Approve and I'll ship it in one pass; if you want to keep the player pages on a lighter/less-editorial variant, say so and I'll dial back the Bebas display type on the player side while keeping the emerald+gold palette.
