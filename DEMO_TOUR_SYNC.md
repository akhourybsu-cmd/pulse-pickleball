# Demo Tour / Dashboard Sync Requirements

## Critical Rule: Dashboard-Tour Parity

**The "Take a Tour" page (`src/pages/DemoTour.tsx`) MUST always match the Dashboard (`src/pages/Dashboard.tsx`) 1:1.**

This is a **MANDATORY** development rule. Any time the dashboard layout, labels, components, or data displays are changed, the Demo Tour page MUST be updated in the same commit to mirror those changes.

## What Must Stay in Sync

1. **All Cards & Metrics**
   - Live Pulse Score card with ECG animation
   - Record (W-L)
   - Win Rate
   - Point Diff / Game
   - Avg. Opponent Rating

2. **Layout & Styling**
   - Responsive breakpoints (mobile, tablet, desktop)
   - Card heights, padding, margins
   - Font sizes at each breakpoint
   - Grid layouts (2-column, 3-column, etc.)

3. **Component Sections**
   - Stats by Court section
   - Your Badges section
   - Bottom action buttons grid
   - All button labels, icons, and order

4. **Button Properties**
   - Height (especially the "Organize a Round Robin Event" button)
   - Padding (vertical and horizontal)
   - Border radius
   - Font size
   - Icon sizes
   - Responsive classes (`md:`, `lg:`, etc.)

5. **Visual Elements**
   - Icons used for each feature
   - Color usage
   - Shadows and effects
   - Animations

## How to Maintain Sync

When making changes to Dashboard:

1. **Before committing**: Check if any of the above elements changed
2. **If yes**: Update `DemoTour.tsx` with matching changes
3. **Test**: Compare the two pages side-by-side to ensure visual parity
4. **Document**: Note in commit message that both pages were synchronized

## Example Sync Scenarios

### Adding a new metric card
- Add to Dashboard → Add same card to DemoTour with demo data
- Match all styling, responsive classes, and positioning

### Changing button heights
- Update Dashboard button classes → Update matching DemoTour button classes
- Ensure uniform height across all bottom buttons

### Reordering sections
- Rearrange Dashboard sections → Rearrange DemoTour sections identically
- Keep tour data attributes aligned

### Adding new features
- New Dashboard feature → Add demo version to DemoTour
- Ensure demo data is realistic and representative

## Future Contributors

This is not optional. The Demo Tour page serves as a live preview of what new users will experience. If it falls out of sync with the actual Dashboard, it creates confusion and misaligned expectations.

**Remember**: Every Dashboard change = Demo Tour update in the same PR/commit.
