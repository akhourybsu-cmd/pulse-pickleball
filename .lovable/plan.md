

# Venue-Community Group Integration Plan

## Overview

This plan implements a deep integration between venue official community groups and their associated venue pages, creating a bidirectional connection that enhances discoverability and applies consistent venue branding.

---

## Current State Analysis

### Database Relationship
The `groups` table already has a `venue_id` column that links venue official groups to their parent venue. There is also an `is_venue_verified` boolean column to indicate verified venue groups.

**Example data found:**
- Group: "Pickleball Palace Official" (type: venue_official)
- Linked to venue: "Pickleball Palace" (slug: pickleball-palace)
- Venue colors: Primary #D4AF37 (gold), Secondary #1A1A1A (dark)

### Current Limitations
1. **GroupDetail page** fetches group data but does not include venue relationship or branding
2. **GroupCard** shows a verified badge but no link to the venue page
3. **PublicHomeTab** (venue landing) has no CTA to join the community group
4. **No venue-branded styling** is applied to venue official groups

---

## Implementation Summary

| Feature | Location | Description |
|---------|----------|-------------|
| Visit Venue Button | GroupDetail header | Button linking to /v/:slug for venue groups |
| Join Community CTA | PublicHomeTab | Button on venue page to join the official group |
| Venue Branding Theme | GroupDetail + GroupFeed | Apply venue's primary/secondary colors |
| Venue Link Badge | GroupCard | Small venue indicator with navigation |

---

## Part 1: Fetch Venue Data with Group

### Changes to `GroupDetail.tsx`

Modify the group fetch query to include the associated venue data when the group type is `venue_official`.

**Updated Query:**
```typescript
// Fetch group with venue relationship
const { data: groupData, error: groupError } = await supabase
  .from('groups')
  .select(`
    *,
    venues:venue_id (
      id,
      name,
      slug,
      logo_url,
      primary_color,
      secondary_color
    )
  `)
  .eq('id', groupId)
  .single();
```

**Update Type Definition** in `useGroups.ts`:
```typescript
export interface Group {
  // ... existing fields
  venue?: {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
    primary_color: string | null;
    secondary_color: string | null;
  } | null;
}
```

---

## Part 2: Visit Venue Button on Group Detail

### Changes to `GroupDetail.tsx` Header

Add a "Visit Venue" button in the header for venue official groups that links to the public venue landing page.

**Visual Placement:**
```text
┌─────────────────────────────────────────────────┐
│ ← [Group Name]              [🏢 Visit] [+] [⋮] │
└─────────────────────────────────────────────────┘
```

**Implementation:**
```tsx
{group.type === 'venue_official' && group.venue?.slug && (
  <Button 
    variant="outline" 
    size="sm"
    className="h-7 text-xs gap-1"
    onClick={() => navigate(`/v/${group.venue.slug}`)}
    style={{ 
      borderColor: group.venue.primary_color || undefined,
      color: group.venue.primary_color || undefined 
    }}
  >
    <Building2 className="h-3 w-3" />
    <span className="hidden sm:inline">Visit Venue</span>
  </Button>
)}
```

---

## Part 3: Join Community CTA on Venue Landing Page

### Changes to `PublicHomeTab.tsx`

Add a section prompting visitors to join the venue's official community group.

**New Section (after Quick Stats):**
```tsx
{/* Community CTA Section */}
{venueGroup && (
  <section className="py-6 px-4">
    <Card 
      className="border-2 cursor-pointer hover:shadow-md transition-all"
      style={{ borderColor: `${primaryColor}30` }}
      onClick={() => navigate(`/player/community/group/${venueGroup.id}`)}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div 
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${primaryColor}15` }}
        >
          <Users className="w-6 h-6" style={{ color: primaryColor }} />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Join Our Community</h3>
          <p className="text-xs text-muted-foreground">
            Connect with {venueGroup.member_count}+ players
          </p>
        </div>
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </CardContent>
    </Card>
  </section>
)}
```

### Add Hook to Fetch Venue's Official Group

**New Hook: `useVenueCommunityGroup.ts`**
```typescript
export function useVenueCommunityGroup(venueId: string | undefined) {
  const [group, setGroup] = useState<VenueGroup | null>(null);
  
  useEffect(() => {
    if (!venueId) return;
    
    const fetchGroup = async () => {
      const { data } = await supabase
        .from('groups')
        .select('id, name, member_count, is_venue_verified')
        .eq('venue_id', venueId)
        .eq('type', 'venue_official')
        .eq('visibility', 'public')
        .maybeSingle();
      
      setGroup(data);
    };
    
    fetchGroup();
  }, [venueId]);
  
  return { group };
}
```

---

## Part 4: Apply Venue Branding to Group UI

### Changes to `GroupDetail.tsx`

Create a venue theme context that applies the venue's colors throughout the group page when it's a venue official group.

**CSS Variable Approach:**
```tsx
const venueColors = group.venue ? {
  '--venue-primary': group.venue.primary_color || DEFAULT_VENUE_COLORS.primary,
  '--venue-secondary': group.venue.secondary_color || DEFAULT_VENUE_COLORS.secondary,
} : {};

return (
  <div 
    className="flex flex-col h-[100dvh]"
    style={venueColors as React.CSSProperties}
  >
```

**Apply to Header:**
```tsx
{/* Header with venue branding */}
<div 
  className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-2 border-b shrink-0"
  style={isVenueGroup ? { 
    borderColor: `${group.venue?.primary_color}30`,
    background: `linear-gradient(to right, ${group.venue?.primary_color}05, transparent)`
  } : undefined}
>
```

**Apply to Tab Indicator:**
```tsx
<TabsTrigger 
  className="data-[state=active]:border-primary"
  style={isVenueGroup && activeTab === tab.value ? {
    borderColor: group.venue?.primary_color
  } : undefined}
>
```

---

## Part 5: Venue Badge on GroupCard

### Changes to `GroupCard.tsx`

For venue official groups, show a small venue indicator that links to the venue page.

**Updated Card Layout:**
```tsx
{/* Venue link for venue_official groups */}
{isVerifiedVenue && group.venue?.slug && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      navigate(`/v/${group.venue.slug}`);
    }}
    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
  >
    <Building2 className="h-2.5 w-2.5" />
    <span>{group.venue.name}</span>
  </button>
)}
```

**Fetch Venue Data in Group Queries:**

Update `useGroups.ts` to include venue relationship:
```typescript
const { data: memberships } = await supabase
  .from('group_members')
  .select(`
    *,
    groups (
      *,
      venues:venue_id (id, name, slug, logo_url, primary_color, secondary_color)
    )
  `)
  .eq('user_id', currentUserId)
  .eq('status', 'active');
```

---

## Part 6: Styling Consistency

### Venue-Themed Elements

When a group is venue official with branding:

| Element | Normal | Venue Themed |
|---------|--------|--------------|
| Tab indicator | Primary green | Venue primary color |
| Verified badge | Amber | Venue primary color |
| CTA buttons | Default primary | Venue primary color |
| Card borders | Default border | Subtle venue color tint |
| Avatar fallback | Random color | Venue primary color |

### CSS Utility Addition
```css
/* Venue-themed group styling */
.venue-themed-group [data-venue-accent] {
  color: var(--venue-primary);
  border-color: var(--venue-primary);
}
```

---

## File Changes Summary

| File | Changes |
|------|---------|
| `src/hooks/useGroups.ts` | Update Group interface, include venue join in queries |
| `src/pages/player/GroupDetail.tsx` | Fetch venue data, add Visit Venue button, apply branding |
| `src/components/community/GroupCard.tsx` | Add venue link badge for venue_official groups |
| `src/components/venue-public/PublicHomeTab.tsx` | Add Join Community CTA section |
| `src/hooks/useVenueCommunityGroup.ts` | NEW: Hook to fetch venue's official group |
| `src/hooks/usePublicVenue.ts` | Optionally extend to return community group |

---

## Technical Considerations

### Navigation Flow
- **Group to Venue**: Click "Visit Venue" button in group header navigates to `/v/:slug`
- **Venue to Group**: Click "Join Community" card navigates to `/player/community/group/:id`
- Both flows work for authenticated and unauthenticated users (with appropriate auth prompts)

### Authentication
- Venue landing page CTA will show regardless of auth status
- Clicking will navigate to group, which will redirect to auth if not logged in
- After auth, user returns to group page

### Branding Isolation
- Venue colors only apply to venue_official groups with `is_venue_verified = true`
- Non-venue groups continue using default Pulse styling
- Fallback to DEFAULT_VENUE_COLORS if venue has no custom colors

---

## Expected User Experience

**Player discovering venue via group:**
1. Joins "Pickleball Palace Official" community group
2. Sees gold/dark themed interface matching the venue
3. Clicks "Visit Venue" to explore courts, events, coaching
4. Books a court directly from venue page

**Player discovering group via venue:**
1. Visits Pickleball Palace venue page
2. Sees "Join Our Community" card with member count
3. Clicks to join the official group
4. Engages with other players, sees events in feed

