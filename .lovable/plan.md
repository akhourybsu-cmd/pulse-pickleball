

## Full-Screen Immersive Group View

### Overview
This enhancement transforms the group detail page into a full-screen, immersive experience when viewing a community group. The standard PlayerShell header and bottom navigation will be hidden, leaving only a minimal back button to return to the Community tab. This maximizes screen real estate for chat and content.

---

### Current Layout

```
┌─────────────────────────────────────────┐
│  [Logo]    [🔔] [👤] [Logout]           │  ← PlayerShell Header (72px)
├─────────────────────────────────────────┤
│  [←] Group Name           [+] [⋮]       │  ← GroupDetail Header
├─────────────────────────────────────────┤
│  [Group Snapshot Section]               │
├─────────────────────────────────────────┤
│  [Feed] [Events] [Chat] [Members]       │  ← Tabs
├─────────────────────────────────────────┤
│                                         │
│           Content Area                  │
│                                         │
├─────────────────────────────────────────┤
│  [Home] [Find] [Events] [Book] [Comm]   │  ← Bottom Nav (~60px)
└─────────────────────────────────────────┘
```

### Proposed Layout (Full-Screen)

```
┌─────────────────────────────────────────┐
│ ← Group Name                 ● 5 online │  ← Minimal header (44px)
├─────────────────────────────────────────┤
│  [Feed] [Events] [Chat] [Members]       │  ← Tabs (compact)
├─────────────────────────────────────────┤
│                                         │
│                                         │
│           Full Content Area             │
│         (Maximum Surface Area)          │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  [Emoji] [Message input...]      [Send] │  ← Input (Chat only)
└─────────────────────────────────────────┘
```

**Space Gained:**
- Remove PlayerShell header: +72px
- Remove bottom navigation: +60px
- Compact group header: +20px
- **Total: ~150px more content space**

---

### Implementation Strategy

#### Approach: Route-Based Shell Detection

The cleanest approach is to have `PlayerShell` detect when the user is on a group detail route and conditionally hide its header and bottom navigation.

**Why this approach:**
- No need for complex context/state passing
- Clean route-based logic (already used for dashboard)
- GroupDetail page can focus on its own layout

---

### Technical Changes

#### 1. PlayerShell.tsx Modifications

Add route detection for group detail pages:

```typescript
const location = useLocation();

// Routes that should be full-screen immersive
const isGroupDetail = location.pathname.includes('/player/community/group/');

// Hide both header AND bottom nav on group detail pages
const hideShell = isGroupDetail;
```

Update the render logic:
- Conditionally hide the top header when `hideShell` is true
- Conditionally hide both mobile and desktop bottom navigation

#### 2. GroupDetail.tsx Modifications

**Minimal Header Design:**
- Single row with back button, group name, online indicator
- Optional action buttons (share, settings) in a compact overflow menu
- Height reduced to ~44px (from current ~56px)

**Layout Changes:**
- Remove `GroupSnapshot` section entirely in immersive mode (or move key info to header)
- Tabs become edge-to-edge with reduced padding
- Content area fills remaining space with `h-[calc(100dvh-88px)]` (header + tabs)

**Updated Header Structure:**
```
┌──────────────────────────────────────────────────────┐
│ [←]  Group Name                    [●3] [Share] [⋮] │
└──────────────────────────────────────────────────────┘
     │        │                       │      │     │
  Back     Title                  Online  Quick  More
  button   (truncated)           count   share  menu
```

---

### File Changes

#### Modified Files

| File | Changes |
|------|---------|
| `src/components/layout/PlayerShell.tsx` | Add route detection for `/player/community/group/`, hide header and bottom nav on these routes |
| `src/pages/player/GroupDetail.tsx` | Redesign header to be minimal and self-contained, adjust height calculations for full viewport |

---

### Detailed Component Changes

#### PlayerShell.tsx

Add immersive route detection alongside existing dashboard check:

```typescript
// Full-screen immersive routes (hide shell chrome)
const isImmersiveRoute = 
  location.pathname.includes('/player/community/group/') ||
  location.pathname.includes('/player/messages/');

// Render header only when NOT on immersive routes
{!isDashboard && !isImmersiveRoute && (
  <header>...</header>
)}

// Render bottom nav only when NOT on immersive routes  
{!isImmersiveRoute && (
  <nav>...</nav>
)}
```

This also applies the same treatment to direct message chats for consistency.

#### GroupDetail.tsx

**New Minimal Header:**

```typescript
<div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/20 bg-background sticky top-0 z-10">
  <Button 
    variant="ghost" 
    size="icon"
    className="h-9 w-9"
    onClick={() => navigate('/player/community')}
  >
    <ArrowLeft className="h-5 w-5" />
  </Button>
  
  <div className="flex-1 min-w-0">
    <h1 className="text-sm font-semibold truncate">{group.name}</h1>
  </div>
  
  <div className="flex items-center gap-1 text-xs text-muted-foreground">
    <OnlineIndicator isOnline={isConnected} size="sm" />
    <span>{onlineCount}</span>
  </div>
  
  {/* Compact action menu */}
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" className="h-8 w-8">
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent>
      <DropdownMenuItem>Share Invite</DropdownMenuItem>
      <DropdownMenuItem>Group Info</DropdownMenuItem>
      {isAdmin && <DropdownMenuItem>Settings</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>
</div>
```

**Updated Height Calculations:**

```typescript
// Use dynamic viewport height for full-screen
<div className="flex flex-col h-[100dvh]">
  {/* Minimal header - ~44px */}
  <div className="...">...</div>
  
  {/* Tabs - ~40px */}
  <Tabs className="flex-1 flex flex-col overflow-hidden">
    <TabsList>...</TabsList>
    
    {/* Content fills remaining space */}
    <div className="flex-1 overflow-hidden">
      <TabsContent className="h-full">...</TabsContent>
    </div>
  </Tabs>
</div>
```

---

### UX Considerations

1. **Gesture Navigation**: Back button is prominently placed for easy thumb access
2. **Context Preservation**: Group name visible at all times so user knows where they are
3. **Quick Actions**: Common actions (share, settings) accessible via overflow menu
4. **Online Presence**: Online count always visible for social awareness
5. **Safe Area**: Bottom input respects `env(safe-area-inset-bottom)` for notched phones

---

### Extended to Direct Messages

For consistency, apply the same full-screen treatment to:
- `/player/messages/:conversationId` (DM chat pages)

This creates a unified immersive messaging experience across both group chats and direct messages.

---

### Summary

| Aspect | Before | After |
|--------|--------|-------|
| Visible headers | 2 (shell + page) | 1 (minimal) |
| Bottom navigation | Always visible | Hidden |
| Content height | ~calc(100vh - 200px) | ~calc(100dvh - 84px) |
| Extra space gained | - | ~150px |
| Visual feel | App within app | Native messaging app |

The result is a clean, focused, full-screen experience that maximizes the chat and content area, making the Community tab feel like a true native social/messaging application.

