

## PULSE Logo Background Audit & Fix Plan

### Overview
After a comprehensive audit of all locations where the PULSE logo is used, I found that the logo appears in **25+ files** across the application. The good news is that **most pages already use the correct teal (`bg-secondary`) background** for the logo. However, there are a few specific locations where the logo appears on potentially problematic backgrounds.

---

### Audit Results: Pages Already Using Teal Background (Good)

These pages correctly display the logo on the `bg-secondary` (teal) background:

| Page/Component | Background | Status |
|----------------|------------|--------|
| `PageHeader.tsx` | `bg-secondary` | ✅ Correct |
| `ProfileHero.tsx` | `bg-secondary` | ✅ Correct |
| `PlayerShell.tsx` | `bg-secondary` | ✅ Correct |
| `HomepageNav.tsx` | `bg-secondary/95` | ✅ Correct |
| `VenueShell.tsx` | Uses `venueTheme.secondary` in logo container | ✅ Correct |
| `TournamentsLanding.tsx` | `bg-secondary` | ✅ Correct |
| `FAQ.tsx` | `bg-secondary` | ✅ Correct |
| `DemoTour.tsx` | `bg-secondary/95` | ✅ Correct |
| `MatchHistory.tsx` | `bg-secondary` | ✅ Correct |
| `PostDetail.tsx` | `bg-secondary` | ✅ Correct |
| `CreateVenueFast.tsx` | `bg-secondary` | ✅ Correct |
| `RoundRobinHub.tsx` | `bg-secondary` (via gradient hero) | ✅ Correct |
| `RoundRobinDetail.tsx` | Uses `PageHeader` (bg-secondary) | ✅ Correct |

---

### Issues Found: Logo on Problematic Backgrounds

#### Issue 1: PWAInstallPrompt.tsx - Logo on White Background
**Location:** Lines 78-81  
**Problem:** The logo is placed inside a container with `bg-white/10` which may be too light in some contexts.
**Current Code:**
```tsx
<div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg bg-white/10 p-2">
  <img src={pulseLogo} alt="PULSE Logo" className="w-full h-full object-contain" />
</div>
```
**Fix:** The outer container already has `bg-secondary` so this is actually fine - the `bg-white/10` is a subtle overlay on teal, not pure white.

#### Issue 2: Auth.tsx - Logo on Teal Background (Already Correct)
**Location:** Lines 251-261  
**Current Code:**
```tsx
<div className="min-h-screen flex items-start md:items-center justify-center bg-secondary p-4 pt-8 md:py-12">
  ...
  <img src={pulseLogo} alt="PULSE" className="h-48 md:h-60 w-auto mx-auto..." />
```
**Status:** ✅ Already using `bg-secondary` - correct!

#### Issue 3: HomepageNav Mobile Menu - Logo on Potentially Light Background
**Location:** Lines 103-115 (SheetContent mobile drawer)  
**Problem:** The mobile menu drawer uses default `SheetContent` styling which could be white in light mode.
**Current Code:**
```tsx
<div className="p-6 border-b border-border/50">
  <Link to="/" onClick={() => setMobileMenuOpen(false)}>
    <img src={logo} alt="PULSE" className="h-12 w-auto" />
  </Link>
</div>
```
**Fix:** Add a teal background bar specifically for the logo section in the mobile menu.

#### Issue 4: VenueInterestProgress.tsx - No Logo Present
**Status:** This component doesn't actually display the logo - it's just a progress bar. The VenueInterestWizard uses a plain `bg-background` layout without a nav header. This is intentional for the wizard flow.

---

### Recommended Fixes

#### Fix 1: HomepageNav.tsx Mobile Menu - Add Teal Header
Add `bg-secondary` to the logo section of the mobile menu drawer:

```tsx
// Current (line 103)
<div className="p-6 border-b border-border/50">

// Fixed
<div className="p-6 border-b border-border/50 bg-secondary rounded-t-lg">
```

This ensures the logo always appears on teal background, matching the desktop header.

---

### Files to Modify

| File | Change Description |
|------|-------------------|
| `src/components/homepage/HomepageNav.tsx` | Add `bg-secondary` to mobile menu logo header section |

---

### No Changes Needed For:

- **PageHeader.tsx** - Already `bg-secondary`
- **ProfileHero.tsx** - Already `bg-secondary`  
- **PlayerShell.tsx** - Already `bg-secondary`
- **VenueShell.tsx** - Already styled with venue theme
- **Auth.tsx** - Already `bg-secondary`
- **PWAInstallPrompt.tsx** - The sheet already has teal header section
- All tournament/round-robin pages - Already using `bg-secondary`
- All standalone pages with headers - Already consistent

---

### Implementation Summary

The audit reveals that **most of the app is already correctly styled** with the PULSE logo appearing on teal (`bg-secondary`) backgrounds. The only fix needed is:

1. **HomepageNav.tsx mobile menu** - Add `bg-secondary` background to the logo container to ensure consistency between light and dark modes

This is a minimal change that will ensure the logo always appears professional and visible on the branded teal background throughout the entire application.

