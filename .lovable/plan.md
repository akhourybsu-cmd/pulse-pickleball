# League Admin — Refinement Pass

Four targeted adjustments. Dark mode is untouched; light mode is where the nested panels break.

## 1. Shrink the hero title

In `src/pages/admin/AdminLeagueDetail.tsx`, the league name currently renders at `text-5xl sm:text-6xl` in Bebas Neue — too dominant.

- Drop to `text-3xl sm:text-4xl`, keep `font-display` (Bebas) and uppercase.
- Reduce the surrounding hero padding from `p-6 sm:p-8` to `p-5 sm:p-6`.
- Tighten the KPI scoreboard: numerals from `text-4xl sm:text-5xl` down to `text-3xl sm:text-4xl`, top margin from `mt-6` to `mt-5`.

Net effect: hero occupies ~40% less vertical space, KPIs still read as the visual anchor.

## 2. Fix light-mode contrast (white panels on emerald)

Root cause: the `.league-admin` scope in `src/index.css` sets its own emerald surface + text tokens, but every nested tab component (Overview, Seasons, Members, etc.) uses shadcn primitives (`Card`, `Input`, `Select`, `Dialog`, `Tabs`, `Table`) whose classes resolve to shadcn semantic tokens (`--card`, `--background`, `--muted`, `--border`, `--foreground`, `--popover`, `--input`, `--ring`). Those tokens are defined at `:root` and `.dark` — in light mode they resolve to white/near-white, which is what you're seeing sit on the dark emerald canvas.

Fix inside `.league-admin` scope only:

- Override the shadcn HSL tokens (`--background`, `--card`, `--card-foreground`, `--popover`, `--popover-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--accent`, `--ring`) with HSL values derived from the emerald palette (surface = `#0A2A20`, surface-2 = `#0F3A2C`, border = `#134A38`, text = `#F5F0E0`, muted-text = `#9CB5A8`, primary = emerald `#0D7A5F`, ring = gold `#C9A84C`).
- Apply the override unconditionally (not gated on `.dark`) so the league admin is always a dark emerald island regardless of the app theme. This is the cleanest way to make every downstream shadcn component render correctly without touching each tab file.
- Keep the existing `--lg-*` custom tokens as-is; they layer on top for bespoke pieces.

No component files need edits — the override propagates through the shadcn primitives already in use.

## 3. Swap the rail nav font

Bebas Neue on the small rail labels is too condensed to scan quickly. In `src/components/admin/leagues/LeagueManageNav.tsx`:

- Remove `font-display` inheritance on the nav labels; explicitly use Barlow (already loaded), weight `600`, `tracking-wide` → `tracking-normal`, size unchanged.
- Keep the small "MANAGING" eyebrow on the group headers in Bebas so it still reads as a section marker, but ensure the button labels themselves are Barlow.
- Keep gold accent bar + emerald active surface.

## 4. Also nudge the "Managing X" desktop label

Above the tab workspace the "MANAGING · X · hint" strip re-echoes the rail. It's fine, but since the hero shrinks, this becomes redundant on desktop. Reduce it to just a subdued hint row: eyebrow "MANAGING" removed, keep the tab title in Barlow bold 14px + hint in dim text.

## Technical section

Files touched:

- `src/index.css` — add shadcn-token overrides inside the existing `.league-admin` block. Roughly:
    ```css
    .league-admin {
      --background: 165 55% 9%;         /* #0A2A20 */
      --foreground: 44 68% 92%;
      --card: 165 55% 9%;
      --card-foreground: 44 68% 92%;
      --popover: 165 55% 12%;
      --popover-foreground: 44 68% 92%;
      --muted: 165 45% 14%;
      --muted-foreground: 156 15% 66%;
      --border: 165 45% 18%;
      --input: 165 45% 18%;
      --primary: 165 80% 26%;
      --primary-foreground: 44 68% 92%;
      --secondary: 165 45% 14%;
      --secondary-foreground: 44 68% 92%;
      --accent: 44 55% 54%;             /* gold */
      --accent-foreground: 165 55% 9%;
      --ring: 44 55% 54%;
    }
    ```
- `src/pages/admin/AdminLeagueDetail.tsx` — hero title/padding/KPI size shrink; simplify the desktop "Managing" strip.
- `src/components/admin/leagues/LeagueManageNav.tsx` — Barlow instead of display font on button labels.

No schema, no data, no other tab files.

## Verification

- `tsgo --noEmit` clean.
- Visually check the page in light mode: nested cards, dialogs, dropdowns, inputs, tables all render with the emerald palette instead of white.
- Confirm hero fits above the fold on the current 890px viewport.
