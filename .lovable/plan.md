

# Tournament Landing Page - Mobile Optimization & Format Label Polish

## Overview

This plan addresses two main issues:
1. **Mobile Optimization**: Ensure all tournament landing page components are fully optimized for mobile devices with proper spacing, touch targets, and content containment
2. **Format Label Polish**: Replace technical database values (like `round_robin`, `single_elimination`) with clean, human-readable labels (like "Round Robin", "Single Elimination")

---

## Issue Analysis

### Problem 1: Technical Labels Showing Raw Database Values

Currently, the `format` field from divisions (e.g., `round_robin`, `double_elimination`) is displayed directly to users without formatting. This appears in:

| Component | Issue |
|-----------|-------|
| `TournamentQuickFacts.tsx:64` | Shows raw `format_type` in the "Format" fact card |
| `TournamentDivisionsGrid.tsx:76` | Shows raw `division.format` in Badge component |

**Solution**: Create a utility function `formatTournamentLabel()` that converts snake_case technical values to Title Case human-readable labels.

### Problem 2: Mobile Layout Gaps

While the components have some responsive classes, several areas need improvement:

| Component | Mobile Issue |
|-----------|--------------|
| **QuickFacts** | Horizontal scroll works but cards are too wide (140px), causing awkward spacing |
| **DivisionsGrid** | Good mobile layout but section title is very large |
| **VenueModule** | Map embed height is fixed at 250px which may be too tall on small screens |
| **Policies** | Accordion padding could be tighter on mobile |
| **StickyBar** | Already good, but needs safe-area consideration for newer iPhones |
| **Hero** | Content spacing could be tighter on very small screens |

---

## Implementation Plan

### Phase 1: Create Format Label Utility

**New File**: `src/lib/formatLabels.ts`

```typescript
// Mapping of technical values to human-readable labels
const FORMAT_LABELS: Record<string, string> = {
  round_robin: "Round Robin",
  single_elimination: "Single Elimination", 
  double_elimination: "Double Elimination",
  swiss: "Swiss",
  pool_play: "Pool Play",
};

export function formatTournamentLabel(value: string): string {
  // Check if we have a specific mapping
  if (FORMAT_LABELS[value]) {
    return FORMAT_LABELS[value];
  }
  
  // Fallback: convert snake_case to Title Case
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}
```

This utility will be reusable across the entire app wherever format labels are displayed.

---

### Phase 2: Apply Format Labels to Components

**File 1**: `src/components/tournament/landing/TournamentQuickFacts.tsx`

- Import the `formatTournamentLabel` utility
- Apply it to the format_type value on line 64

```typescript
// Before
const format_type = event.divisions?.[0]?.format || "Round Robin";

// After  
import { formatTournamentLabel } from "@/lib/formatLabels";

const rawFormat = event.divisions?.[0]?.format || "round_robin";
const format_type = formatTournamentLabel(rawFormat);
```

**File 2**: `src/components/tournament/landing/TournamentDivisionsGrid.tsx`

- Import the utility
- Apply it to the Badge display on line 76

```typescript
// Before
<Badge variant="secondary">{division.format}</Badge>

// After
<Badge variant="secondary">{formatTournamentLabel(division.format)}</Badge>
```

---

### Phase 3: Mobile Optimization Improvements

#### A. TournamentQuickFacts.tsx - Tighter Mobile Cards

**Changes**:
- Reduce mobile card width from 140px to 120px for better fit on smaller screens
- Add `scrollbar-hide` class (already present) and snap behavior
- Reduce mobile padding from p-4 to p-3
- Smaller icons and text on mobile

```typescript
// Line 101 - Update the card styling
className={`flex-shrink-0 w-[120px] md:w-auto snap-start flex flex-col items-center text-center p-3 md:p-4 rounded-xl ...`}

// Line 107 - Smaller icons on mobile
<fact.icon className="h-5 w-5 md:h-6 md:w-6 mb-2 md:mb-3 ..." />

// Line 110 - Smaller text on mobile
className="text-xl md:text-3xl font-bold ..."
```

#### B. TournamentDivisionsGrid.tsx - Mobile Section Header

**Changes**:
- Reduce mobile heading size
- Tighter section padding on mobile

```typescript
// Line 29 - Reduce mobile section padding
className="py-12 md:py-24 px-4 bg-muted/30"

// Line 37 - Smaller mobile heading
<h2 className="text-2xl md:text-4xl font-bold ..."
```

#### C. TournamentHeroSection.tsx - Tighter Mobile Spacing

**Changes**:
- Reduce mobile spacing in the content area
- Smaller mobile title

```typescript
// Line 117 - Tighter mobile spacing
className="text-center text-white space-y-4 md:space-y-6"

// Line 129 - Smaller mobile title
className="text-3xl sm:text-5xl md:text-7xl font-bold ..."
```

#### D. TournamentVenueModule.tsx - Responsive Map Height

**Changes**:
- Reduce map height on mobile
- Stack buttons vertically on very small screens

```typescript
// Line 105 - Responsive map height
className="rounded-xl overflow-hidden shadow-lg h-[180px] md:h-[250px]"

// Line 110 - Stack buttons on mobile
<div className="flex flex-col sm:flex-row gap-3">
```

#### E. TournamentPoliciesAccordion.tsx - Mobile Padding

**Changes**:
- Reduce padding in accordion items on mobile

```typescript
// Line 124 - Responsive accordion trigger padding
className="px-4 md:px-6 py-3 md:py-4 ..."

// Line 132 - Responsive content padding  
className="px-4 md:px-6 pb-4 md:pb-6"

// Line 133 - Reduce left padding on mobile
className="text-muted-foreground whitespace-pre-wrap leading-relaxed pl-4 md:pl-8"
```

#### F. TournamentSocialProof.tsx - Mobile Text Sizing

**Changes**:
- Reduce large heading size on mobile

```typescript
// Line 49 - Smaller mobile heading
className="text-2xl md:text-4xl font-bold text-foreground"
```

#### G. TournamentFooterCTA.tsx - Mobile Button Sizing

**Changes**:
- Slightly smaller buttons on mobile

```typescript
// Line 41 - Responsive button padding
className="... text-base md:text-lg px-6 md:px-10 py-5 md:py-6"
```

#### H. TournamentContactCard.tsx - Mobile Card Padding

**Changes**:
- Reduce card padding on mobile

```typescript
// Line 55 - Responsive padding
className="p-4 md:p-8 space-y-4 md:space-y-6"
```

#### I. TournamentAboutSection.tsx - Mobile Typography

**Changes**:
- Reduce mobile heading size

```typescript
// Line 19 - Smaller mobile heading
className="text-2xl md:text-4xl font-bold text-foreground"
```

#### J. TournamentSponsorsGrid.tsx - Mobile Card Sizing

**Changes**:
- Reduce minimum card height on mobile

```typescript
// Line 61 - Responsive min-height
className="... min-h-[120px] md:min-h-[160px] ..."
```

---

## Files to Modify

### New File (1)
1. `src/lib/formatLabels.ts` - Format label utility function

### Modified Files (10)
1. `src/components/tournament/landing/TournamentQuickFacts.tsx`
2. `src/components/tournament/landing/TournamentDivisionsGrid.tsx`
3. `src/components/tournament/landing/TournamentHeroSection.tsx`
4. `src/components/tournament/landing/TournamentVenueModule.tsx`
5. `src/components/tournament/landing/TournamentPoliciesAccordion.tsx`
6. `src/components/tournament/landing/TournamentSocialProof.tsx`
7. `src/components/tournament/landing/TournamentFooterCTA.tsx`
8. `src/components/tournament/landing/TournamentContactCard.tsx`
9. `src/components/tournament/landing/TournamentAboutSection.tsx`
10. `src/components/tournament/landing/TournamentSponsorsGrid.tsx`

---

## Technical Summary

| Change Category | Details |
|-----------------|---------|
| **Format Labels** | Create reusable utility to convert `snake_case` database values to "Title Case" display labels |
| **Mobile Sizing** | Reduce font sizes, padding, and element sizes on mobile using responsive classes |
| **Mobile Containment** | Ensure all content stays within screen boundaries with proper overflow handling |
| **Touch Targets** | Maintain 44px+ touch targets for all interactive elements |
| **8pt Grid** | Continue following the 8pt spacing system for consistency |

---

## Expected Outcomes

1. **Clean Labels**: Technical formats like `round_robin` display as "Round Robin"
2. **Better Mobile Fit**: All content fits within mobile screen boundaries without horizontal overflow
3. **Tighter Mobile Layout**: Reduced whitespace and element sizes for better mobile density
4. **Consistent Touch Targets**: All buttons remain easily tappable on touch devices
5. **Reusable Utility**: The format label function can be used across the entire app

