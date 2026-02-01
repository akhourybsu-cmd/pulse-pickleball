

# Bottom-Fixed Composer with Slide-Up Expansion Plan

## Overview

This plan transforms the post composer and chat input experiences in the Community Group page to follow a modern mobile-first pattern: a slim, fixed-to-bottom input bar that expands into a full slide-up drawer when tapped, similar to Instagram, iMessage, and other social apps.

---

## Current State vs. Proposed State

| Component | Current | Proposed |
|-----------|---------|----------|
| **GroupFeed Composer** | Full composer at TOP of feed with textarea + quick actions | Slim fixed bar at BOTTOM → expands to slide-up drawer on tap |
| **GroupChat Input** | Input bar at BOTTOM (already correct position) | Same position, but tapping expands into full-screen compose mode |
| **QuickPostComposer** | Center modal dialog | Bottom sheet drawer (vaul) that slides up from bottom |

---

## Visual Flow

```text
┌─────────────────────────┐
│       Feed Content      │
│         (scrolls)       │
│                         │
│                         │
│                         │
├─────────────────────────┤
│ [📷] What's happening?  │  ← Slim fixed bar (collapsed)
└─────────────────────────┘

        ↓ User taps ↓

┌─────────────────────────┐
│                         │
│  ──────  drag handle    │
│  Create Post            │
│                         │
│  [Post] [Photo] [LFG]   │  ← Tab options
│                         │
│  ┌───────────────────┐  │
│  │                   │  │
│  │   Textarea        │  │  ← Full compose area
│  │                   │  │
│  └───────────────────┘  │
│                         │
│  [Cancel]      [Post]   │
└─────────────────────────┘
```

---

## Part 1: Create Collapsed Composer Bar Component

### New Component: `CollapsedComposerBar.tsx`

A slim, tappable bar fixed to the bottom of the screen that triggers the full composer.

**Features**:
- Fixed at bottom with safe area padding
- Avatar + placeholder text + quick action icons
- Subtle background blur and shadow
- Touch feedback animation

**Structure**:
```tsx
<div className="fixed bottom-0 left-0 right-0 z-40 
               border-t bg-background/95 backdrop-blur-sm 
               safe-area-bottom">
  <div className="flex items-center gap-3 px-4 py-2.5">
    <Avatar className="h-8 w-8" />
    
    {/* Tappable placeholder that opens drawer */}
    <button 
      onClick={onExpand}
      className="flex-1 h-10 px-4 rounded-full bg-muted/50 
                 text-muted-foreground text-left text-sm"
    >
      What's happening?
    </button>
    
    {/* Quick action shortcuts */}
    <Button variant="ghost" size="icon" onClick={onPhotoClick}>
      <Camera className="h-5 w-5" />
    </Button>
  </div>
</div>
```

---

## Part 2: Convert QuickPostComposer to Bottom Sheet

### Changes to `QuickPostComposer.tsx`

Convert from Dialog to Drawer (vaul) for a slide-up bottom sheet experience.

**Key Changes**:
- Replace `Dialog` with `Drawer` from vaul
- Use `DrawerContent` with proper mobile height constraints
- Add drag handle for swipe-to-dismiss
- Animate entrance from bottom

**Updated Structure**:
```tsx
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerFooter 
} from '@/components/ui/drawer';

<Drawer open={open} onOpenChange={onOpenChange}>
  <DrawerContent className="max-h-[85vh]">
    <DrawerHeader>
      <DrawerTitle>Create Post</DrawerTitle>
    </DrawerHeader>
    
    <div className="flex-1 overflow-y-auto px-4">
      {/* Tab navigation and form fields */}
    </div>
    
    <DrawerFooter>
      {/* Cancel and Post buttons */}
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

---

## Part 3: Update GroupFeed Layout

### Changes to `GroupFeed.tsx`

**Remove**: The large inline composer at the top of the feed

**Add**: Integration with the new collapsed bar system

**Layout Changes**:
- Remove the motion.div composer section (lines 187-240)
- Keep CommunityPulse status bar at top
- Add bottom padding to scroll area to account for fixed bar

**Updated Flow**:
```tsx
<div className="space-y-5 pb-20"> {/* Bottom padding for fixed bar */}
  {/* Community Status Bar stays at top */}
  <CommunityPulse ... />
  
  {/* Pinned Posts */}
  {pinnedPosts.length > 0 && (...)}
  
  {/* Regular Posts */}
  {...}
</div>

{/* Collapsed bar is rendered by parent GroupDetail */}
```

---

## Part 4: Update GroupDetail to Manage Composer State

### Changes to `GroupDetail.tsx`

Add the collapsed composer bar for the Feed tab and manage its expanded state.

**New State**:
```tsx
const [composerExpanded, setComposerExpanded] = useState(false);
```

**Render Collapsed Bar Conditionally**:
```tsx
{/* Show collapsed composer bar only on Feed tab */}
{activeTab === 'feed' && (
  <CollapsedComposerBar
    onExpand={() => setComposerExpanded(true)}
    onPhotoClick={() => openQuickPost('photo')}
  />
)}

{/* Full composer drawer */}
<QuickPostComposer
  open={composerExpanded || quickPostOpen}
  onOpenChange={(open) => {
    setComposerExpanded(open);
    setQuickPostOpen(open);
  }}
  ...
/>
```

---

## Part 5: Enhanced Chat Input Expansion

### Changes to `GroupChat.tsx`

While the chat input is already at the bottom, we can enhance the typing experience with an expansion animation.

**Current**: Single-line input that grows with content  
**Enhanced**: Tap anywhere in input area to get a focused compose mode with more vertical space

**Optional Enhancement**:
- Add a "focus mode" state that expands textarea height
- Smooth animation when transitioning between collapsed/expanded
- Keyboard-aware repositioning

```tsx
const [focusMode, setFocusMode] = useState(false);

<motion.div
  animate={{ height: focusMode ? 'auto' : 'auto' }}
  className={cn(
    "border-t bg-background/95 backdrop-blur-sm",
    focusMode && "pb-safe" // Safe area when expanded
  )}
>
  <Textarea
    onFocus={() => setFocusMode(true)}
    onBlur={() => setFocusMode(false)}
    className={cn(
      "transition-all duration-200",
      focusMode ? "min-h-[100px]" : "min-h-[40px]"
    )}
  />
</motion.div>
```

---

## Part 6: Safe Area and Keyboard Handling

### CSS Additions to `index.css`

Add utilities for safe area handling on mobile:

```css
/* Safe area for bottom fixed elements */
.safe-area-bottom {
  padding-bottom: env(safe-area-inset-bottom, 0);
}

/* Padding for content above fixed bottom bar */
.pb-composer-bar {
  padding-bottom: calc(60px + env(safe-area-inset-bottom, 0));
}
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| **NEW** `src/components/community/CollapsedComposerBar.tsx` | Slim fixed-bottom bar component |
| `src/components/community/QuickPostComposer.tsx` | Convert Dialog → Drawer (vaul bottom sheet) |
| `src/components/community/GroupFeed.tsx` | Remove inline composer, add bottom padding |
| `src/pages/player/GroupDetail.tsx` | Add collapsed bar, manage expand state |
| `src/components/community/GroupChat.tsx` | Optional: enhanced focus mode expansion |
| `src/index.css` | Safe area utility classes |

---

## Technical Details

### Dependencies Used
- **vaul** (already installed) - For the Drawer bottom sheet component
- **framer-motion** (already installed) - For smooth animations

### Mobile Considerations
- Safe area insets for notched devices
- Keyboard-aware positioning (CSS env variables)
- Touch-friendly hit targets (min 44px)
- Swipe-to-dismiss on the drawer

### Animation Specs
- Drawer slide-up: spring animation, 300ms
- Collapsed bar: fade in on tab switch
- Focus transitions: 200ms ease-out

---

## Expected Outcomes

| Improvement | Result |
|-------------|--------|
| More vertical space for feed | Composer no longer takes up top area |
| Familiar mobile pattern | Users recognize the "tap to expand" pattern |
| Better typing experience | Full drawer gives room for longer posts |
| Cleaner visual hierarchy | Feed content is the hero, composer is secondary |
| Consistent with Chat tab | Both tabs use bottom-anchored input pattern |

