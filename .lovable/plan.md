

# Mobile Optimization Plan for Community Group Page

## Overview

After reviewing all components on the Group Detail page, I've identified multiple areas where content may overflow or display poorly on smaller mobile screens. This plan addresses spacing, centering, and overflow issues to ensure nothing goes off-screen.

---

## Issues Identified

### 1. GroupFeed.tsx - Composer Section
- **Issue**: Composer avatar + textarea layout may cause horizontal overflow on narrow screens
- **Issue**: Quick action chips may overflow horizontally without proper containment
- **Issue**: Post button inside textarea can get crowded on small screens

### 2. GroupWelcomeCard.tsx - Action Grid
- **Issue**: `grid-cols-3` with fixed padding causes cramped cards on small screens
- **Issue**: Action button labels ("Post an Update", "Schedule a Session") truncate poorly

### 3. ComposerQuickActions.tsx
- **Issue**: `overflow-x-auto` but no visual indicator of scrollability
- **Issue**: Chips may be too wide for very small screens

### 4. QuickPostComposer.tsx (Dialog)
- **Issue**: LFG tab has `grid-cols-3` for date/time/spots that gets cramped
- **Issue**: Tab labels hidden on mobile but icons only may not be clear enough

### 5. CommunityPulse.tsx
- **Issue**: Stats row can wrap awkwardly if too long
- **Issue**: Text may overflow on narrow screens

### 6. PostCard in GroupFeed.tsx
- **Issue**: Avatar + author info + timestamp + menu button layout can overflow
- **Issue**: Reactions container may overflow on very small screens
- **Issue**: Post type badges may wrap awkwardly

### 7. GroupSchedule.tsx
- **Issue**: RSVP buttons `flex-1` in a row of 3 - text may truncate on small screens
- **Issue**: Event date/time layout may wrap poorly

### 8. GroupFiles.tsx
- **Issue**: File info row with multiple items can overflow
- **Issue**: Grid view toggle buttons may crowd the upload button

### 9. GroupDetail.tsx Header
- **Issue**: Header with back button + title + online count + action buttons may overflow
- **Issue**: Tab labels hidden on mobile (icon-only) - labels should show when space allows

### 10. GroupChat.tsx
- **Issue**: Input bar with emoji button + textarea + send button may overflow

---

## Part 1: GroupFeed Composer Mobile Optimization

### Changes to `GroupFeed.tsx`

**Composer Layout**:
- Reduce avatar size on mobile (`h-9 w-9` → `h-8 w-8 sm:h-10 sm:w-10`)
- Adjust padding and gaps for mobile
- Ensure Post button doesn't overlap textarea content

**Quick Actions**:
- Add scroll indicators or fade hints
- Reduce chip padding on smallest screens

```tsx
// Composer adjustments
<Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0 ring-2 ring-background">

// Textarea adjustments
className="min-h-[52px] sm:min-h-[56px] resize-none pr-16 sm:pr-20 text-sm"

// Post button area
<div className="absolute right-1.5 sm:right-2 bottom-1.5 sm:bottom-2 flex items-center gap-1">
```

---

## Part 2: GroupWelcomeCard Mobile Optimization

### Changes to `GroupWelcomeCard.tsx`

**Responsive Grid**:
- Change from `grid-cols-3` to responsive: `grid-cols-1 sm:grid-cols-3`
- On mobile, stack action cards vertically as horizontal rows
- Reduce padding on mobile

```tsx
// Responsive grid - stack on mobile
<div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
  {actions.map((action, index) => (
    <motion.button
      className={cn(
        // Mobile: horizontal layout
        'flex flex-row sm:flex-col items-center',
        'p-3 sm:p-4 rounded-xl gap-3 sm:gap-0',
        // Mobile: left-align content
        'justify-start sm:justify-center',
        ...
      )}
    >
      <div className="sm:mb-2 text-xl sm:text-2xl">{action.icon}</div>
      <div className="text-left sm:text-center">
        <span className="text-sm font-medium">{action.label}</span>
        <span className="text-xs text-muted-foreground hidden sm:block">
          {action.description}
        </span>
      </div>
    </motion.button>
  ))}
</div>
```

---

## Part 3: ComposerQuickActions Mobile Optimization

### Changes to `ComposerQuickActions.tsx`

**Chip Sizing**:
- Slightly smaller chips on mobile
- Add fade edge to indicate scrollability

```tsx
// Scrollable container with fade hint
<div className={cn(
  'flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar',
  'pb-0.5', // Prevent clipping
  className
)}>
  {actions.map((action) => (
    <Button
      className={cn(
        'h-6 sm:h-7 px-2 sm:px-3 gap-1 sm:gap-1.5 text-xs font-medium',
        'rounded-full shrink-0 border',
        ...
      )}
    >
```

---

## Part 4: QuickPostComposer Mobile Optimization

### Changes to `QuickPostComposer.tsx`

**Dialog Width**:
- Ensure full-width on mobile with proper margins

**LFG Tab Grid**:
- Stack date/time/spots on mobile

```tsx
// Responsive grid for LFG inputs
<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
  <div className="space-y-2">
    <Label>Date</Label>
    <Input type="date" ... />
  </div>
  <div className="grid grid-cols-2 sm:grid-cols-1 gap-3 sm:gap-0">
    <div className="space-y-2">
      <Label>Time</Label>
      <Input type="time" ... />
    </div>
    <div className="space-y-2">
      <Label>Spots</Label>
      <Input type="number" ... />
    </div>
  </div>
</div>
```

---

## Part 5: CommunityPulse Mobile Optimization

### Changes to `CommunityPulse.tsx`

**Stats Row**:
- Allow wrapping on mobile
- Reduce text size slightly

```tsx
<div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
  {stats.map((stat, index) => (
    <span key={stat.label} className="flex items-center gap-1.5 whitespace-nowrap">
      ...
    </span>
  ))}
</div>
```

---

## Part 6: PostCard Mobile Optimization

### Changes to `PostCard` in `GroupFeed.tsx`

**Header Layout**:
- Ensure proper truncation and wrapping
- Make menu button position consistent

**Reactions**:
- Allow reactions to wrap if needed
- Reduce gap on mobile

```tsx
// Header with better mobile handling
<div className="flex items-start justify-between gap-2 sm:gap-3 mb-2 sm:mb-3">
  <div className="flex items-start gap-2 sm:gap-2.5 flex-1 min-w-0">
    <Avatar className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">

// Author name and timestamp - stack on very small screens
<div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
  <span className="font-medium text-sm truncate max-w-[120px] sm:max-w-none">

// Reactions - smaller padding on mobile
<div className="flex items-center gap-0.5 bg-muted/40 rounded-full px-0.5 sm:px-1 py-0.5">
  <Button
    className={cn(
      'h-6 sm:h-7 gap-0.5 sm:gap-1 px-1.5 sm:px-2 text-xs rounded-full',
```

---

## Part 7: GroupSchedule Mobile Optimization

### Changes to `GroupSchedule.tsx`

**RSVP Buttons**:
- Use icon-only on mobile, text on larger screens
- Stack buttons on very small screens if needed

```tsx
<div className="flex items-center gap-1.5 sm:gap-2 w-full">
  <Button
    size="sm"
    className="flex-1 gap-1 px-2 sm:px-3"
  >
    <Check className="h-4 w-4" />
    <span className="hidden sm:inline">Going</span>
  </Button>
  <Button
    size="sm"
    className="flex-1 gap-1 px-2 sm:px-3"
  >
    <HelpCircle className="h-4 w-4" />
    <span className="hidden sm:inline">Maybe</span>
  </Button>
  <Button
    size="sm"
    className="flex-1 gap-1 px-2 sm:px-3"
  >
    <X className="h-4 w-4" />
    <span className="hidden sm:inline">Can't Go</span>
  </Button>
</div>
```

---

## Part 8: GroupFiles Mobile Optimization

### Changes to `GroupFiles.tsx`

**Header Controls**:
- Stack upload button and view toggle on mobile if needed
- Responsive grid columns

```tsx
<div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
  <Button className="gap-2 w-full sm:flex-1">
    ...
  </Button>
  {files.length > 0 && (
    <ToggleGroup className="self-end sm:self-auto">
      ...
    </ToggleGroup>
  )}
</div>
```

**File List**:
- Truncate file info more aggressively on mobile
- Hide less important metadata

```tsx
<div className="flex items-center gap-1 sm:gap-2 text-xs text-muted-foreground">
  <span>{formatFileSize(file.file_size)}</span>
  <span className="hidden sm:inline">•</span>
  <span className="hidden sm:inline">
    {formatDistanceToNow(...)}
  </span>
</div>
```

---

## Part 9: GroupDetail Header & Tabs Mobile Optimization

### Changes to `GroupDetail.tsx`

**Header**:
- Ensure title truncates properly
- Reduce icon button sizes on mobile

```tsx
<div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 border-b ...">
  <Button size="icon" className="h-8 w-8 sm:h-9 sm:w-9 -ml-0.5 sm:-ml-1">
  
  <div className="flex-1 min-w-0">
    <h1 className="text-sm font-semibold truncate">{group.name}</h1>
  </div>

  {/* Online indicator - hide count text on very small screens */}
  <div className="flex items-center gap-1 sm:gap-1.5 text-xs text-muted-foreground">
    <OnlineIndicator ... />
    <span className="hidden xs:inline">{onlineCount}</span>
    <span className="hidden sm:inline">online</span>
  </div>
```

**Tabs**:
- Show labels on sm+ screens (already done)
- Ensure icons are visible and touchable

---

## Part 10: GroupChat Mobile Optimization

### Changes to `GroupChat.tsx`

**Input Bar**:
- Reduce button sizes on mobile
- Ensure textarea doesn't overflow

```tsx
<div className="flex items-end gap-1.5 sm:gap-2">
  {/* Emoji Button - hide on mobile or smaller */}
  <Button 
    className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 hidden sm:flex"
  >

  {/* Message Input */}
  <Textarea
    className="min-h-[38px] sm:min-h-[40px] max-h-[100px] sm:max-h-[120px] ..."
  />

  {/* Send Button */}
  <Button 
    className="h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-full"
  >
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/components/community/GroupFeed.tsx` | Responsive composer, smaller avatars/buttons on mobile, PostCard spacing |
| `src/components/community/GroupWelcomeCard.tsx` | Stack action cards on mobile, horizontal layout |
| `src/components/community/ComposerQuickActions.tsx` | Smaller chips on mobile |
| `src/components/community/QuickPostComposer.tsx` | Responsive LFG grid layout |
| `src/components/community/CommunityPulse.tsx` | Wrap-friendly stats row |
| `src/components/community/GroupSchedule.tsx` | Icon-only RSVP buttons on mobile |
| `src/components/community/GroupFiles.tsx` | Responsive header, truncated file info |
| `src/pages/player/GroupDetail.tsx` | Compact header on mobile, smaller touch targets |
| `src/components/community/GroupChat.tsx` | Smaller input bar on mobile, hidden emoji button |

---

## Expected Outcomes

| Issue | Solution | Result |
|-------|----------|--------|
| Horizontal overflow | Responsive breakpoints, truncation | No content off-screen |
| Cramped buttons | Icon-only on mobile, stacked layouts | Better touch targets |
| Unreadable text | Proper truncation, smaller fonts | Clean, readable UI |
| Inconsistent spacing | 8pt grid with responsive adjustments | Consistent visual rhythm |
| Poor hierarchy | Maintained on mobile with adjusted sizing | Clear organization |

---

## Technical Approach

All changes use Tailwind's responsive prefixes:
- Default (no prefix) = mobile-first styles
- `sm:` = 640px and up
- `md:` = 768px and up

This ensures mobile gets the most constrained layout, with enhancements for larger screens.

