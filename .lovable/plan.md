## Goal
Add a "My communities" quick-access section to the player home screen so users can jump into any group they're a member of in one tap.

## Where it lands
On `Dashboard.tsx` (player home), inserted on both desktop (left column) and mobile stacks, positioned **after "My round robins"** and **before "Up next"** — communities are a higher-frequency destination than match history but shouldn't displace active RR events.

## What it looks like
A horizontal scrollable rail of compact group cards (avatar + name, optional unread/activity dot), plus a "See all →" link to `/player/community`.

```text
My communities                                    See all →
┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│ [G1] │ │ [G2] │ │ [G3] │ │ [G4] │ │ [G5] │  →
│ Name │ │ Name │ │ Name │ │ Name │ │ Name │
└──────┘ └──────┘ └──────┘ └──────┘ └──────┘
```

- Tap a card → `/player/community/:groupId`
- Empty state (user in zero groups): single CTA card "Find a community →" → `/player/community`
- Section hidden entirely if the data query is still loading (skeleton) or fails silently

## Technical notes
- New component: `src/components/dashboard/MyCommunitiesRail.tsx`
- Data source: existing `useGroups()` hook (already filters to groups the user is a member of)
- Limit to ~8 most recently active groups in the rail; the rest are reachable via "See all"
- Use existing `SectionHeader` for consistency with other dashboard sections
- 8pt spacing, dark theme tokens, Outfit headings per project standards

## Out of scope
- Unread message badges (would need a separate query for last-read timestamps — happy to do as a follow-up)
- Reordering/pinning favorite groups
- Changes to the `/player/community` index page itself