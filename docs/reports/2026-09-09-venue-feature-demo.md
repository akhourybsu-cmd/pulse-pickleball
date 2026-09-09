# Venue paid-feature demo

## Scope

Added an interactive, fictional venue preview to **Manage venue → Plan & upgrades**.
The main demo entry opens Court booking; each feature card also opens its own demo tab.
Owners and managers can explore it before verification or payment setup, including when checkout is disabled.

- **Court booking:** sample availability, one-hour slot selection, explicit example rental price, and an in-memory reservation simulation.
- **Facility operations:** sample court statuses, programs and reservations, plus an interactive Court 3 maintenance block.
- Both views use the same local state. Maintenance removes sample availability, reservations appear on the schedule, and maintenance never overwrites a sample reservation.
- Reset and closing/reopening clear sample edits. Feature switching returns to the top; closing restores focus to the exact launcher. Mobile selection has a shortcut to the reservation summary.
- Pricing distinguishes the $10/month PULSE feature subscription from the illustrative $24 court rental. Both features cost $20/month; the community remains free.

## Isolation

The demo receives no venue ID or real venue/user data. Its reducer and fixture data have no network or storage access. It does not mount booking forms, Stripe checkout, or payment hooks. It cannot activate modules, grant access, create events, reserve real courts, or charge a card. Existing verification and owner-only checkout gates remain unchanged. The sample venue is explicitly fictional and the layout illustrative.

The demo is lazy-loaded only when requested, with a local error boundary. It does not add the demo body to the app's initial bundle.

## Verification

- Full Vitest run: **893 passed, 32 skipped, 10 todo** (68 passing test files).
- Focused demo and upgrade tests: **12 passed**, including invalid/unavailable selection, duplicate prevention, maintenance conflicts, shared state and reset isolation.
- Final production web build: passed (63 seconds); existing large-chunk warning remains.
- Browser checks: desktop, 390px light mobile, and 320px dark mobile.
- Mobile document widths matched scroll widths (388/388 and 318/318); demo inner scroll area also had no horizontal overflow.
- Exercised booking-to-manager propagation, maintenance-to-player propagation, mobile summary shortcut, per-feature launcher, reset, Escape, focus restoration, and clean state on reopening.

## Release

Web-only release through the existing Firebase Hosting workflow. No SQL migration, Supabase deployment, Stripe configuration, or native Android/Google Play changes are needed. The web release includes the Android PWA. Production deployment status is recorded in the GitHub Actions run for the release commit.
