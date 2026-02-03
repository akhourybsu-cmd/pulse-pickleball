
# Header Visibility & Navigation Audit - Complete Fix Plan

## Executive Summary

After a comprehensive audit of all pages across PULSE, I've identified **18 pages** with header-related issues. The main problems fall into three categories:

1. **White-on-white visibility issues** - The `BackToDashboard` component uses hardcoded `text-white` which is invisible on light backgrounds
2. **Missing navigation headers** - Some pages lack the standard PULSE header with logo, making them feel disconnected
3. **Inconsistent header patterns** - Mix of header styles across similar page types creates a disjointed experience

---

## Category A: BackToDashboard Visibility Issues (Critical)

### Problem

The `BackToDashboard` component (`src/components/BackToDashboard.tsx`) hardcodes `text-white` styling which works on dark/teal headers but is **invisible on light backgrounds** in light mode.

### Affected Pages

| Page | Current Issue | Impact |
|------|---------------|--------|
| `TournamentRegister.tsx` | White button on light container background | Back button invisible in light mode |
| `AdminTestAccounts.tsx` | White button on light container background | Back button invisible in light mode |
| Loading states in `TournamentRegister.tsx` | White button on light background | Navigation broken during loading |

### Solution

Update `BackToDashboard.tsx` to be theme-aware:

```text
Before: className="text-white hover:text-white hover:bg-white/10"
After:  className="text-foreground hover:text-foreground/90 hover:bg-muted"
```

The component should also accept a `variant` prop to allow dark-background pages (like RoundRobinHub) to explicitly use white styling when needed.

---

## Category B: Missing Standard PULSE Headers

### Problem

Several pages lack the standard PULSE header (teal `bg-secondary` bar with logo + ThemeToggle), making them feel disconnected from the app:

### Affected Pages

| Page | Current State | Recommended Fix |
|------|---------------|-----------------|
| `TournamentRegister.tsx` | Raw `BackToDashboard` + `ThemeToggle` on container | Add standard PULSE header nav |
| `CreateRoundRobin.tsx` (WizardContainer) | Minimal progress header only | Add PULSE logo to wizard header |
| `VenueInterestWizard.tsx` | Minimal progress header only | Add PULSE logo to wizard header |
| `AdminTestAccounts.tsx` | Raw `BackToDashboard` only | Add standard PULSE header nav |

### Solution

Create a consistent `SimpleHeader` component for standalone pages:

```typescript
// New component: src/components/SimpleHeader.tsx
interface SimpleHeaderProps {
  backTo?: string;        // Navigation destination
  backLabel?: string;     // Button text (default: "Back")
  showLogo?: boolean;     // Show PULSE logo (default: true)
}
```

---

## Category C: Pages With Correct Headers (Reference)

These pages implement headers correctly and serve as the pattern to follow:

| Page | Header Pattern | Notes |
|------|----------------|-------|
| `Tournaments.tsx` | `PageHeader` component | Full navigation with user actions |
| `TournamentLanding.tsx` | `TournamentPublicHeader` | Minimal, scroll-aware for public pages |
| `TournamentEventDetail.tsx` | Standard PULSE nav bar | Logo + ThemeToggle |
| `TournamentMatchScore.tsx` | Standard PULSE nav bar | Logo + ThemeToggle + back button |
| `ViewProfile.tsx` | Standard PULSE nav bar | Logo + ThemeToggle + back button |
| `MatchHistory.tsx` | Standard PULSE nav bar | Logo only + ThemeToggle |
| `RoundRobinHub.tsx` | `BackToDashboard` with dark bg override | Works because of dark hero background |
| `TournamentAdmin.tsx` | Standard PULSE nav bar | Logo links to admin-dashboard |
| `PlayerShell.tsx` | Conditional header (hidden on dashboard) | Handles immersive routes correctly |
| `VenueShell.tsx` | Dynamic venue-branded header | Uses venue colors correctly |

---

## Category D: Wizard Pages Header Improvements

### Problem

Wizard pages (`CreateRoundRobin`, `VenueInterestWizard`) have minimal headers that don't include the PULSE logo, making them feel less connected to the brand.

### Current State

```
WizardProgress.tsx:
- Only shows back chevron + "Step X of Y" + spacer
- No PULSE branding
- No exit/close option on round-robin wizard
```

### Solution

Update wizard progress components to optionally show the PULSE logo and provide consistent navigation:

```text
Updated WizardProgress.tsx:
[ChevronLeft] [PULSE Logo (centered)] [X close button]
            Step 1 of 8
        [===progress bar===]
```

---

## Implementation Plan

### Phase 1: Fix BackToDashboard Component

**File:** `src/components/BackToDashboard.tsx`

Changes:
- Add theme-aware default styling using `text-foreground`
- Add `variant` prop: `"default" | "light-on-dark"`
- Default variant uses theme-aware colors
- `light-on-dark` variant uses white text for dark backgrounds

### Phase 2: Add Standard Header to TournamentRegister

**File:** `src/pages/TournamentRegister.tsx`

Changes:
- Replace raw `BackToDashboard` + `ThemeToggle` with standard PULSE nav bar
- Add PULSE logo linking to `/tournaments`
- Include proper back navigation button
- Apply to all states (loading, error, main)

### Phase 3: Add Standard Header to AdminTestAccounts

**File:** `src/pages/AdminTestAccounts.tsx`

Changes:
- Add standard PULSE nav bar header
- Logo links to admin dashboard
- Include ThemeToggle

### Phase 4: Update Wizard Headers

**Files:**
- `src/components/round-robin/wizard/WizardProgress.tsx`
- `src/components/venue-interest/VenueInterestProgress.tsx`

Changes:
- Add optional PULSE logo prop
- Add close/exit button that navigates to appropriate destination
- Maintain consistent height (64px mobile, 72px desktop)

### Phase 5: Update RoundRobinHub BackToDashboard Usage

**File:** `src/pages/RoundRobinHub.tsx`

Changes:
- Use new `variant="light-on-dark"` prop instead of className override
- Ensures future-proofing if component changes

---

## Detailed File Changes

### 1. BackToDashboard.tsx (Refactor)

```typescript
// Add variant prop for explicit styling control
interface BackToDashboardProps {
  onNavigate?: () => boolean;
  className?: string;
  variant?: "default" | "light-on-dark";
  backTo?: string;  // Allow custom back destination
}

// Default styling becomes theme-aware
const baseStyles = {
  default: "text-foreground hover:text-foreground/80 hover:bg-muted",
  "light-on-dark": "text-white hover:text-white hover:bg-white/10"
};
```

### 2. TournamentRegister.tsx (Header Addition)

Add this header structure to all render paths:

```typescript
<div className="min-h-screen bg-background">
  <nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
    <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
      <Link to={`/tournament/${eventId}`}>
        <img src={logo} alt="PULSE Logo" className="h-[60px] sm:h-[75px] w-auto" />
      </Link>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <Button variant="ghost" size="sm" onClick={() => navigate(`/tournament/${eventId}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      </div>
    </div>
  </nav>
  
  <div className="container max-w-4xl py-8">
    {/* ... existing content ... */}
  </div>
</div>
```

### 3. AdminTestAccounts.tsx (Header Addition)

Same pattern as TournamentRegister but with admin-specific navigation:

```typescript
<nav className="bg-secondary border-b border-secondary-foreground/10 shadow-sm">
  <div className="w-full max-w-[1280px] mx-auto px-4 lg:px-6 py-5 flex items-center justify-between h-[72px]">
    <Link to="/admin-dashboard">
      <img src={logo} alt="PULSE Logo" ... />
    </Link>
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <Button variant="ghost" size="sm" onClick={() => navigate("/admin-dashboard")}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Admin
      </Button>
    </div>
  </div>
</nav>
```

### 4. WizardProgress.tsx (Enhanced)

```typescript
interface WizardProgressProps {
  currentStep: number;
  totalSteps: number;
  onBack: () => void;
  canGoBack: boolean;
  showLogo?: boolean;      // NEW: Show PULSE logo
  onClose?: () => void;    // NEW: Close/exit action
  closeDestination?: string; // NEW: Where close navigates to
}
```

### 5. VenueInterestProgress.tsx (Already Has Close)

This component already has an X close button - just needs the logo addition for brand consistency.

---

## Files to Modify

| File | Change Type |
|------|-------------|
| `src/components/BackToDashboard.tsx` | Refactor - add theme-aware styling |
| `src/pages/TournamentRegister.tsx` | Add standard PULSE header nav |
| `src/pages/AdminTestAccounts.tsx` | Add standard PULSE header nav |
| `src/components/round-robin/wizard/WizardProgress.tsx` | Add logo + close button |
| `src/components/venue-interest/VenueInterestProgress.tsx` | Add logo (close already exists) |
| `src/pages/RoundRobinHub.tsx` | Update to use new variant prop |

---

## Testing Checklist

After implementation, verify:

1. **Light Mode Testing**
   - [ ] TournamentRegister back button is visible
   - [ ] AdminTestAccounts back button is visible
   - [ ] All headers have proper contrast

2. **Dark Mode Testing**
   - [ ] All headers maintain visibility
   - [ ] PULSE logo visible on teal backgrounds
   - [ ] No white-on-white issues

3. **Navigation Testing**
   - [ ] Back buttons navigate to correct destinations
   - [ ] Logo clicks navigate appropriately
   - [ ] Wizard close buttons work

4. **Responsive Testing**
   - [ ] Mobile headers maintain proper height (64px)
   - [ ] Desktop headers maintain proper height (72px)
   - [ ] Touch targets are 44px minimum

---

## Expected Outcome

After implementation:

1. **Consistent Branding** - All pages show PULSE logo in header
2. **Theme-Aware Navigation** - Back buttons visible in both light and dark modes
3. **Clear Navigation** - Users can always return to previous context
4. **Professional Polish** - No orphaned pages without proper headers
5. **Accessibility** - Proper color contrast ratios maintained
