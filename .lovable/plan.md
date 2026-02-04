

# Tournament Pages Separation: Manage vs. Browse

## Overview

Split the current combined `/tournaments` page into two distinct pages:
1. **Manage Tournaments** (`/tournaments/manage`) - For users to view and manage tournaments they own
2. **Browse Tournaments** (`/tournaments/browse`) - Public discovery page with advanced search and filtering

The current `/tournaments` route will redirect to `/tournaments/browse` for consistency.

---

## New Page Architecture

```text
/tournaments          → Redirect to /tournaments/browse
/tournaments/browse   → Public discovery page (new)
/tournaments/manage   → Owner management page (new)
/tournaments/new      → Create tournament (existing)
/tournaments/:id      → Tournament detail (existing)
```

---

## Page 1: Manage Tournaments (`/tournaments/manage`)

### Purpose
Allow authenticated users to view, manage, and take action on tournaments they own.

### Features
- Protected route (requires authentication)
- List of user's tournaments with status badges
- Quick actions: Edit, View Public Page, Customize, Delete
- Filter by status (Draft, Upcoming, Live, Completed, Cancelled)
- Sort by date or name
- Link to create new tournament

### UI Elements
| Element | Description |
|---------|-------------|
| Header | "Manage Tournaments" with Create button |
| Empty state | "No tournaments yet" with Create CTA |
| Tournament cards | Name, dates, status badge, division count, payment status |
| Actions | Edit, View Public, Customize Landing Page |
| Filters | Status pills (All, Draft, Active, Completed) |

---

## Page 2: Browse Tournaments (`/tournaments/browse`)

### Purpose
Public-facing discovery page for players to find and register for tournaments.

### Features
- No authentication required (but can show personalized recommendations if logged in)
- Advanced search with multiple filter options
- Location-based filtering (city/state input or "Near Me")
- Date range filtering
- Skill level filtering
- Registration status filtering (Open, Coming Soon, Closed)

### Filter Options

| Filter | Type | Options |
|--------|------|---------|
| Search | Text input | Search by name, venue, location |
| Location | Text input + "Near Me" button | City/State or use browser geolocation |
| Distance | Dropdown | 25mi, 50mi, 100mi, Any |
| Date Range | Pills | This Week, This Month, Next 3 Months, All |
| Skill Level | Range | 2.0 - 5.0+ |
| Registration | Pills | Open Now, Opening Soon, All |

### Data Source
Query `tournaments_events` where:
- `is_public = true`
- `public_view_enabled = true`
- `payment_status = 'paid'`
- Ordered by `start_date` ascending

Join with `venues` table when `venue_id` is present to get structured location data (city, state).

---

## Implementation Steps

### Step 1: Create Browse Tournaments Page
- New file: `src/pages/BrowseTournaments.tsx`
- Hero section with search bar
- Filter bar with chips/pills
- Tournament card grid
- Pagination or infinite scroll

### Step 2: Create Manage Tournaments Page
- New file: `src/pages/ManageTournaments.tsx`
- Auth guard (redirect to login if not authenticated)
- Fetch tournaments where `created_by = user.id`
- Status filter tabs
- Tournament management cards with actions

### Step 3: Create Tournament Filter Hook
- New file: `src/hooks/useBrowseTournaments.ts`
- Encapsulate all filtering logic
- Support server-side and client-side filtering
- Include debounced search

### Step 4: Update Routing
- Update `src/App.tsx`:
  - Change `/tournaments` to redirect to `/tournaments/browse`
  - Add `/tournaments/browse` route
  - Add `/tournaments/manage` route (protected)

### Step 5: Update Navigation Links
- Update TournamentsLanding "View All" button to go to `/tournaments/manage`
- Update Dashboard "Browse Tournaments" to go to `/tournaments/browse`
- Add "Manage" link in header when user is authenticated

---

## Technical Details

### Database Query for Browse Page

```sql
SELECT 
  te.id,
  te.name,
  te.description,
  te.location,
  te.start_date,
  te.end_date,
  te.status,
  te.divisions_count,
  te.registration_enabled,
  te.registration_open_date,
  te.registration_close_date,
  v.name as venue_name,
  v.city as venue_city,
  v.state as venue_state
FROM tournaments_events te
LEFT JOIN venues v ON te.venue_id = v.id
WHERE te.is_public = true
  AND te.public_view_enabled = true
  AND te.payment_status = 'paid'
  AND te.start_date >= CURRENT_DATE
ORDER BY te.start_date ASC
```

### Location Search Strategy

Since tournaments may have freeform `location` text or structured `venue_id`:
1. If `venue_id` exists, use `venues.city` and `venues.state` for filtering
2. Otherwise, perform text search on the `location` field
3. "Near Me" button: Use browser geolocation API, then filter client-side by calculating distance to venue coordinates (if available)

### New Hook: `useBrowseTournaments`

```typescript
interface BrowseTournamentFilters {
  search?: string;
  city?: string;
  state?: string;
  dateRange?: 'this_week' | 'this_month' | 'next_3_months' | 'all';
  skillLevelMin?: number;
  skillLevelMax?: number;
  registrationStatus?: 'open' | 'opening_soon' | 'all';
  limit?: number;
}

interface BrowseTournament {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  venue_name?: string;
  venue_city?: string;
  venue_state?: string;
  start_date: string;
  end_date: string;
  status: string;
  divisions_count: number;
  registration_enabled: boolean;
  registration_open_date: string | null;
  registration_close_date: string | null;
  is_registration_open: boolean;
}
```

---

## UI Components

### New Components
1. `TournamentBrowseFilters.tsx` - Filter bar with all filter options
2. `TournamentBrowseCard.tsx` - Card designed for discovery (CTA-focused)
3. `TournamentManageCard.tsx` - Card designed for management (action-focused)
4. `LocationSearchInput.tsx` - Location input with "Near Me" button

### Reused Components
- `Badge` for status indicators
- `Input` for search
- `Button` for filter pills
- `Card` for tournament cards
- `Skeleton` for loading states

---

## Route Protection

```typescript
// Browse - Public
<Route path="/tournaments/browse" element={<BrowseTournaments />} />

// Manage - Protected
<Route path="/tournaments/manage" element={
  <AuthGuard>
    <ManageTournaments />
  </AuthGuard>
} />
```

---

## File Changes Summary

| Action | File |
|--------|------|
| Create | `src/pages/BrowseTournaments.tsx` |
| Create | `src/pages/ManageTournaments.tsx` |
| Create | `src/hooks/useBrowseTournaments.ts` |
| Create | `src/components/tournament/TournamentBrowseFilters.tsx` |
| Create | `src/components/tournament/TournamentBrowseCard.tsx` |
| Create | `src/components/tournament/TournamentManageCard.tsx` |
| Create | `src/components/tournament/LocationSearchInput.tsx` |
| Modify | `src/App.tsx` - Update routes |
| Modify | `src/pages/TournamentsLanding.tsx` - Update links |
| Modify | `src/pages/Dashboard.tsx` - Update "Browse Tournaments" link |

---

## Mobile Considerations

- Filters collapse into a drawer/sheet on mobile
- "Near Me" prominent for mobile users
- Horizontal scroll for filter pills
- Cards stack vertically on mobile

