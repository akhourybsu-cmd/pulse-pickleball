## Match Wizard: Three Updates

### 1. Disable Singles ("Coming soon")
File: `src/components/match-wizard/steps/MatchTypeStep.tsx`
- Make the Singles card non-interactive: remove `onClick` handler, add `opacity-50`, `pointer-events-none`, `cursor-not-allowed`.
- Replace its subtitle "1 vs 1 match" with a "Coming soon" badge/text.
- Keep Doubles fully functional.
- Also update `getInitialFormData` in `useMatchWizardSteps.ts` to ignore any saved `'singles'` preference and default to `'doubles'`.

### 2. Stop auto-populating the submitter as a player
File: `src/components/match-wizard/steps/PlayerSelectionStep.tsx`
- In `loadCurrentUserAndRecent`, remove the block that auto-fills `team1[0]` with the current user. Just load the user id for context and recent players.
- Submitter will now search/select themselves like any other player.
- Side effect to verify: the "can't remove yourself from slot 0" guard in `handleRemovePlayer` and the `isCurrentUser` "You" label in `SlotDisplay` remain functional once the user adds themselves manually — keep them as-is so the UX still flags "You" wherever the submitter ends up.

### 3. PULSE logo in wizard header
File: `src/components/match-wizard/MatchWizardContainer.tsx`
- Replace the "Record Match" / "Saved to your PULSE history" text block in the sticky header with the PULSE logo (`import logo from "@/assets/pulse-logo-premium.svg"`), matching the sizing used elsewhere (`h-[60px] sm:h-[75px] w-auto`).
- Keep the back arrow on the left.
- Move the "Record Match" title + "Saved to your PULSE history" subtitle into the body, rendered above `MatchWizardProgress` inside the content container, so the screen still tells the user what they're doing.

### Out of scope
No backend, schema, submit logic, or other steps are touched.
