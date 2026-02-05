
# HomepageNav Enhancement: Fix 404s and Add Desktop Menu

## Problem Summary

The sandwich menu in `HomepageNav.tsx` has two routes that lead to 404 errors, and the structured navigation is only available on mobile. This plan fixes the broken links and extends the platform hub menu to desktop.

---

## Issue 1: Broken Routes

| Current Link | Issue | Fix |
|--------------|-------|-----|
| `/browse-events` | Route doesn't exist | Change to `/events/browse` |
| `/settings` | Route doesn't exist | Change to `/settings/notifications` |

**Evidence from App.tsx:**
- Line 330: `<Route path="/events/browse" element={<BrowseEvents />} />`
- Line 333: `<Route path="/settings/notifications" element={<NotificationSettings />} />`

---

## Issue 2: Desktop Menu Missing

Currently, desktop shows a flat list of 4 links:
- Players, Venues, Events, Community, (Login)

The mobile menu has a richer "Platform Hub" structure with:
- **Explore**: Players, Venues, Events, Community
- **Play**: Round Robins, Tournaments (with submenu)
- **Account** (when logged in): Dashboard, Settings

The desktop experience should match by using a dropdown menu triggered by a hamburger icon or similar, providing access to the same grouped navigation.

---

## Solution Design

### Desktop Navigation Pattern

Replace the flat desktop links with a similar dropdown/popover menu that mirrors the mobile structure:

```text
Desktop Header (current):
[Logo]     Players | Venues | Events | Community | Login    [Theme] [CTA]

Desktop Header (proposed):
[Logo]     Players | Venues | Events | Community | [Menu ▼]  [Theme] [CTA]
                                                    │
                                                    ├─ Play
                                                    │   ├─ Round Robins
                                                    │   └─ Tournaments ▸
                                                    │       ├─ Browse
                                                    │       └─ Host
                                                    └─ Account (if logged in)
                                                        ├─ Dashboard
                                                        └─ Settings
```

**Alternative (Simpler)**: Make the hamburger menu available on all screen sizes, keeping desktop inline links for primary navigation but adding the full menu for depth.

---

## Implementation Steps

### Step 1: Fix Broken Routes

Update `menuSections` in HomepageNav.tsx:

**Explore section:**
```typescript
{ label: "Events", href: "/events/browse", icon: Calendar }
// Changed from /browse-events
```

**Account section:**
```typescript
{ label: "Settings", href: "/settings/notifications", icon: Settings }
// Changed from /settings
```

Also update `desktopNavLinks` for consistency:
```typescript
{ label: "Events", href: "/events/browse", icon: Calendar }
```

### Step 2: Add Desktop Popover Menu

Create a `NavigationMenu` dropdown for desktop that provides access to Play and Account sections:

1. Keep the existing inline links (Players, Venues, Events, Community) for quick access
2. Add a "More" dropdown using `DropdownMenu` or `Popover` component
3. The dropdown contains:
   - **Play** section with Round Robins and Tournaments submenu
   - **Account** section (Dashboard, Settings) - shown only when logged in
   - **Login** link - shown only when NOT logged in

### Step 3: Make Mobile Menu Icon Always Visible (Alternative)

Alternatively, show the hamburger menu on desktop too (alongside inline links):
- Remove `md:hidden` from `SheetTrigger`
- Desktop users get both quick inline links AND the full menu for deeper navigation

---

## Recommended Approach

**Hybrid Navigation:**
1. Keep desktop inline links for primary discovery (Players, Venues, Events, Community)
2. Add a dropdown "More" menu for secondary navigation (Play, Account)
3. Keep mobile Sheet menu as-is with full structure

This provides:
- Quick access to main sections on desktop
- Full platform depth available via dropdown
- Consistent experience across devices

---

## File Changes Summary

| Action | File | Description |
|--------|------|-------------|
| Modify | `src/components/homepage/HomepageNav.tsx` | Fix broken routes, add desktop dropdown |

---

## Technical Implementation

### Route Fixes

```typescript
// desktopNavLinks - line ~16
{ label: "Events", href: "/events/browse", icon: Calendar },

// menuSections.explore.items - line ~30
{ label: "Events", href: "/events/browse", icon: Calendar },

// menuSections.account.items - line ~52
{ label: "Settings", href: "/settings/notifications", icon: Settings },
```

### Desktop Dropdown Addition

Add after the existing desktop nav links, before the Login link:

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";

// Inside desktop nav section
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button variant="ghost" size="sm" className="gap-1">
      More
      <ChevronDown className="h-4 w-4" />
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end" className="w-56">
    <DropdownMenuLabel>Play</DropdownMenuLabel>
    <DropdownMenuItem asChild>
      <Link to="/round-robin">Round Robins</Link>
    </DropdownMenuItem>
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>Tournaments</DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuItem asChild>
          <Link to="/tournaments/browse">Browse Tournaments</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/tournaments/new">Host a Tournament</Link>
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
    
    {isLoggedIn && (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Account</DropdownMenuLabel>
        <DropdownMenuItem asChild>
          <Link to="/player/dashboard">Dashboard</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/settings/notifications">Settings</Link>
        </DropdownMenuItem>
      </>
    )}
    
    {!isLoggedIn && (
      <>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/auth">Login</Link>
        </DropdownMenuItem>
      </>
    )}
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Also Update Footer

The `HomepageFooter.tsx` also has the broken `/browse-events` link that should be updated to `/events/browse` for consistency.

---

## Final Route Mapping

| Menu Item | Current Route | Fixed Route |
|-----------|---------------|-------------|
| Events (Explore) | `/browse-events` | `/events/browse` |
| Settings (Account) | `/settings` | `/settings/notifications` |

All other routes are valid and will not cause 404s.
