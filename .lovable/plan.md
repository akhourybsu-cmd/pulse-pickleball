## Step 2 (Players) — Design & UX review

Below is what I found reading the current `PlayerSelectionStep.tsx` against your 411px mobile viewport, and what I'd change. Nothing here adds new features — just tightening polish, spacing, click targets, and a few glitchy behaviors.

### Issues found

**1. Two team cards side-by-side are too tight at 411px**
Each card ends up ~180px wide and holds: avatar + "+ Add Player" + chevron, then once filled also a remove ✕. "+ Add Player" truncates on smaller phones; the remove ✕ sits flush against the chevron column.

**2. "Active slot" gold ring never clears**
`activeSlot` is set when you tap a slot but is *never* cleared when the sheet closes (cancel / backdrop / picking a player only clears via re-open). Result: a slot keeps a gold ring after dismiss until you tap a different one — reads as a glitch.

**3. Search hijacks the tab**
Typing in the sheet's search field force-switches the tab to "Suggested" mid-keystroke (`if (e.target.value && tab !== "suggested") setTab("suggested")`). If you're on Friends and start typing, the pill jumps. Surprising.

**4. The "Guest" pill isn't a tab — it's a button disguised as one**
All other pills swap the list below; "Guest" closes the sheet and opens a dialog. Visually identical, behaviorally different. Plus there's already an "Add Guest" button in the section header, so we have two paths doing the same thing with one of them masquerading as a filter.

**5. Filled slots have no "swap" affordance**
Once a player is in a slot, the only way to change them is the remove ✕ then re-open the sheet. Tapping the row body does nothing. People expect to tap the row to replace.

**6. Sheet height = 88vh + bottom safe area**
On phones with browser chrome the bottom rows in the list can sit under the home indicator / URL bar. The sheet also resets `tab` and `search` on every open/close transition, which causes a visible flicker when closing.

**7. Tap targets**
- Empty slot row: ~40px tall — under the 44px iOS guideline.
- Remove ✕ on filled slot: 24×24 — too small, especially next to an avatar.
- Pill row "Add Guest" in header: h-9 (36px) — borderline.

**8. Redundant profile fetches**
`currentUserProfile` fetch + the `selectedIds` hydration effect can fire two queries for the same user when they're picked. Minor, but the second call is wasted.

**9. Shield icon next to "Team 1 / Team 2"**
Decorative but `fill-primary/15` on a `text-primary` stroked icon paints a tinted shield that competes with the team label. Reads noisy at small sizes.

**10. Self-row in Suggested**
Now that you can pick yourself, the "You" row lives mixed into the Suggested list with the same visual weight as everyone else. Easy to miss; also easy to scroll past.

---

### Proposed changes (scoped, no new features)

**Layout & spacing**
- Keep teams side-by-side but bump the inner card to `p-3.5`, slot row to `py-3` (min-height 48px), gap-y between slots to `gap-2.5`.
- Replace "+ Add Player" with just "Add player" (no plus, the avatar circle already implies add) so it never truncates at 360–411px.
- Move the remove ✕ to a 32×32 hit area and pull it 4px away from the chevron column.
- Soften the team-card border (`border-border/60`) and drop the per-card shadow — the page already has structure.

**Active-slot state**
- Clear `activeSlot` whenever the sheet closes (`onOpenChange(false)` → `setActiveSlot(null)`) and whenever a player or guest is committed. Removes the persistent gold-ring artifact.

**Sheet behavior**
- Stop force-switching the tab when the user types. Search results render *inside the current tab's list area* instead, or always show under whatever tab is selected.
- Remove the "Guest" pill from the tab row. Keep one entry point: the header "Add Guest" button. (One affordance, one mental model.)
- Replace the dialog-on-top-of-sheet pattern with an inline guest panel that slides in within the same sheet — no modal stacking.
- Reduce sheet to `max-h-[85vh]` with `pb-[env(safe-area-inset-bottom)]` so the last row clears the home indicator.
- Don't reset `tab` and `search` on close — only on open. Avoids the flash on dismiss.

**Filled slot interaction**
- Make the row body tappable to re-open the sheet (swap player). ✕ stays as remove. Add `aria-label="Replace player"` on the row.

**Self in Suggested**
- Pin a dedicated "You" card at the very top of the suggested list with a slightly different background (`bg-primary/5`, primary-tinted border) and the "You" badge — separated by a 1px divider from the rest. Easy to spot, one tap to add yourself.

**Tap targets**
- Header "Add Guest" → `h-10`.
- Slot remove ✕ → 32×32 hit area, icon stays 14px.
- Pill tabs → `py-2` (min 36px) and `min-w-[88px]` so they don't dance when the active state widens text.

**Polish**
- Replace the filled-shield decoration with a small dot indicator (filled vs empty) — cleaner at 16px.
- Use `tabular-nums` consistently on PULSE ratings (already done on slot, missing on result row).
- Hydrate the current user's profile once, share between `profileCache` and the suggested "You" row — drop the duplicate query.

### Files touched
- `src/components/match-wizard/steps/PlayerSelectionStep.tsx` (only this file)

No business-logic or data changes; nothing leaves this component.