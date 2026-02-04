

# Tournament Custom URL Feature

## Overview

Yes, this is absolutely possible! The database already has a `slug` column in `tournaments_events` that's been added but is currently unused. This feature would allow tournament creators to set custom URLs like `pulsepb.com/tournament/summer-open-2024` instead of the current UUID-based URLs.

---

## Current State

**What already exists:**
- `slug` column in `tournaments_events` table (currently all NULL)
- Route `/tournament/:slug` already defined in App.tsx
- Working pattern in Venues: `/v/pickleball-palace` resolves via slug lookup

**What's missing:**
- UI for tournament creators to set their custom slug
- Logic in TournamentLanding to resolve slug vs ID
- Slug uniqueness validation
- URL preview display

---

## Implementation Plan

### 1. Update TournamentLanding to Support Slug Resolution

Modify `src/pages/TournamentLanding.tsx` to:
- First try to find tournament by slug
- If not found, try to find by ID (backwards compatibility)
- This allows both `/tournament/summer-open-2024` AND `/tournament/abc-123-uuid` to work

```text
Current:  .eq("id", slug)
New:      .or(`slug.eq.${slug},id.eq.${slug}`)
```

### 2. Add Custom URL Field to Tournament Settings

Create a new "Custom URL" section in tournament management with:
- Slug input field with automatic formatting (lowercase, hyphens)
- Live preview: `pulsepb.com/tournament/[your-slug]`
- Copy URL button
- Uniqueness validation with real-time feedback

**Location Options:**
- Option A: Add to `TournamentCustomize.tsx` under a new "Sharing" or "URL" tab
- Option B: Add to `TournamentDetail.tsx` settings section
- Option C: Add to tournament creation wizard basics step

Recommendation: **Option A** - TournamentCustomize is the natural home for "public-facing" settings

### 3. Add Slug Validation

Create validation logic:
- Check uniqueness across all tournaments
- Auto-format: lowercase, replace spaces with hyphens, remove special characters
- Reserved slugs: prevent "new", "admin", "register", etc.
- Minimum length: 3 characters
- Maximum length: 50 characters

### 4. Database Considerations

The `slug` column already exists as nullable text. We should:
- Add a unique constraint (if not present)
- Keep it nullable so tournaments can exist without custom URLs
- Auto-generate suggestion from tournament name (e.g., "Summer Open 2024" → "summer-open-2024")

---

## User Flow

```text
Tournament Creator Flow:
1. Creates tournament via wizard
2. Goes to Customize page
3. Sees new "Custom URL" section
4. Enters desired slug: "summer-championship-2024"
5. Sees preview: pulsepb.com/tournament/summer-championship-2024
6. System validates uniqueness in real-time
7. Saves changes
8. Can now share the clean URL

Player Flow:
1. Receives link: pulsepb.com/tournament/summer-championship-2024
2. Opens link
3. System resolves slug → tournament ID
4. Shows tournament landing page
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/pages/TournamentLanding.tsx` | Update query to resolve by slug OR id |
| `src/pages/TournamentCustomize.tsx` | Add "Custom URL" section with slug input |
| `src/hooks/useTournaments.ts` | Add `updateTournamentSlug` function with validation |
| `src/lib/slugValidation.ts` | New file for slug formatting/validation utilities |

---

## UI Design for Custom URL Section

```text
┌─────────────────────────────────────────────────────────────────┐
│ Custom URL                                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Create a memorable link for your tournament                     │
│                                                                  │
│  pulsepb.com/tournament/ [summer-championship-2024    ]          │
│                          ↑ input field                           │
│                                                                  │
│  ✓ This URL is available!                                        │
│                                                                  │
│  Full URL: https://pulsepb.com/tournament/summer-championship-2024
│  [Copy Link]                                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Technical Details

### Slug Resolution Logic

```typescript
// In TournamentLanding.tsx
const { data: eventData } = await supabase
  .from("tournaments_events")
  .select(`*, divisions:tournaments_divisions(...)`)
  .or(`slug.eq.${slug},id.eq.${slug}`)
  .eq("public_view_enabled", true)
  .single();
```

### Slug Formatting Utility

```typescript
// src/lib/slugValidation.ts
export function formatSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // spaces → hyphens
    .replace(/[^a-z0-9-]/g, '')  // remove special chars
    .replace(/-+/g, '-')         // collapse multiple hyphens
    .replace(/^-|-$/g, '');      // trim leading/trailing hyphens
}

export async function isSlugAvailable(slug: string, excludeId?: string): Promise<boolean> {
  const query = supabase
    .from('tournaments_events')
    .select('id')
    .eq('slug', slug);
  
  if (excludeId) {
    query.neq('id', excludeId);
  }
  
  const { data } = await query.maybeSingle();
  return !data;
}
```

---

## Additional Considerations

### SEO & Sharing
- Clean URLs are better for social sharing
- Consider adding Open Graph meta tags with tournament name/image
- Custom slugs make links more trustworthy to click

### Reserved Slugs
Block these from being used:
- `new`, `create`, `admin`, `register`, `list`, `all`, `search`

### Auto-Suggest Feature
When user first opens custom URL section:
- Pre-fill with suggested slug based on tournament name
- Show "Suggested: summer-championship-2024"

### Analytics Tracking
Consider logging when custom slugs are used vs UUIDs to measure adoption

---

## Implementation Priority

1. **Phase 1**: Add slug resolution to TournamentLanding (backwards compatible)
2. **Phase 2**: Add slug input UI to TournamentCustomize
3. **Phase 3**: Add real-time validation and auto-suggest
4. **Phase 4**: Add copy-link and QR code generation

