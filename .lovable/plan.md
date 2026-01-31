

# App Performance Optimization Plan

## Executive Summary

After a comprehensive audit of the PULSE codebase, I've identified several optimization opportunities to improve speed between tabs and across the app. The current implementation has some good foundations (lazy loading, prefetch on hover) but lacks optimization in data fetching, component memoization, and tab rendering strategies.

---

## Current State Analysis

### What's Working Well
- **Code splitting**: All 60+ pages use `React.lazy()` for route-level code splitting
- **Route prefetching**: `PlayerShell` prefetches routes on hover
- **Query client config**: Reasonable stale times (5 min) and gc times (30 min)
- **Realtime subscriptions**: Properly cleaned up on unmount

### Performance Issues Identified

| Issue | Location | Impact |
|-------|----------|--------|
| Community hooks don't use React Query | `useGroupPosts`, `useGroupEvents`, `useGroupChat`, `useGroups` | No caching between tab switches |
| Tab content re-renders on every switch | `GroupDetail.tsx` | All hooks re-fetch on tab change |
| Missing component memoization | Most community components | Unnecessary re-renders |
| Multiple sequential queries | `useGroups`, `useGroupPosts` | Waterfall fetching pattern |
| Presence channel recreated on tab switch | `useGroupPresence` used in multiple components | Duplicate connections |
| No profile caching | Profile fetched in each hook separately | Redundant database calls |

---

## Part 1: Convert Community Hooks to React Query

**Problem**: Current hooks use `useState` + `useEffect` patterns. When switching tabs within a group, all data is refetched because the hook state is lost.

**Solution**: Convert to React Query for automatic caching, deduplication, and stale-while-revalidate behavior.

### Modified Hooks

#### 1. `useGroupPosts.ts` → React Query

```typescript
// Before: useState pattern - refetches on every mount
const [posts, setPosts] = useState([]);
useEffect(() => { fetchPosts(); }, [groupId]);

// After: React Query - cached between tab switches
const { data: posts = [], isLoading } = useQuery({
  queryKey: ['group-posts', groupId],
  queryFn: () => fetchGroupPosts(groupId),
  staleTime: 30 * 1000, // 30 seconds stale time
  enabled: !!groupId,
});
```

#### 2. `useGroupEvents.ts` → React Query

Same pattern - cache events data so switching to Feed tab and back doesn't refetch.

#### 3. `useGroupChat.ts` → React Query + Optimistic Updates

Messages cached but with shorter stale time (10s) due to realtime nature.

#### 4. `useGroupMembers.ts` → React Query

Cache members list with 1-minute stale time.

#### 5. `useGroups.ts` → React Query

Cache the main groups list so Community page loads instantly on revisit.

---

## Part 2: Optimize Tab Rendering Strategy

**Problem**: All tab content is currently rendered and all hooks execute on every render, even for hidden tabs.

**Solution**: Implement lazy tab rendering with state preservation.

### Changes to `GroupDetail.tsx`

1. **Lazy mount tabs**: Only mount tab content when first accessed
2. **Keep mounted**: Once a tab is visited, keep it mounted but hidden (preserves scroll position and state)
3. **Suspend non-active hooks**: Use React Query's `enabled` option tied to active tab

```typescript
// Track which tabs have been visited
const [visitedTabs, setVisitedTabs] = useState<Set<string>>(new Set(['feed']));

// On tab change, mark as visited
const handleTabChange = (tab: string) => {
  setActiveTab(tab);
  setVisitedTabs(prev => new Set([...prev, tab]));
};

// Only render tabs that have been visited
<TabsContent value="chat" className={cn(
  "h-full m-0 flex flex-col",
  activeTab !== 'chat' && "hidden"
)}>
  {visitedTabs.has('chat') && (
    <GroupChat groupId={groupId!} currentUserId={currentUserId} />
  )}
</TabsContent>
```

---

## Part 3: Component Memoization

**Problem**: Components like `PostCard`, `GroupCard`, `EventCard` re-render on every parent render.

**Solution**: Wrap with `React.memo` and use `useCallback` for handlers.

### Components to Memoize

| Component | Reason |
|-----------|--------|
| `PostCard` (in GroupFeed) | Already in separate function, wrap with memo |
| `GroupCard` | Rendered in lists, benefits from memo |
| `GroupSchedule` event items | Extracted to separate memoized component |
| `GroupMembers` member cards | Extracted to `MemberCard` with memo |
| `ChatMessage` | Already memoized ✓ |
| `ComposerQuickActions` | Static component, should be memoized |

### Example Memoization

```typescript
// GroupFeed.tsx - Memoize PostCard
const PostCard = memo(function PostCard({ post, currentUserId, ... }: PostCardProps) {
  // ... component code
});

// GroupFeed.tsx - Use callbacks for handlers
const handleReaction = useCallback((postId: string, emoji: string) => {
  toggleReaction(postId, emoji);
}, [toggleReaction]);
```

---

## Part 4: Shared Profile Cache

**Problem**: User profiles are fetched multiple times - in `useGroupPosts`, `useGroupEvents`, `useGroupChat`, etc.

**Solution**: Create a centralized profile cache using React Query.

### New Hook: `useProfileCache.ts`

```typescript
// Batch fetch profiles with deduplication
export function useProfiles(userIds: string[]) {
  return useQuery({
    queryKey: ['profiles', userIds.sort().join(',')],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url, current_rating')
        .in('id', userIds);
      return new Map(data?.map(p => [p.id, p]) || []);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: userIds.length > 0,
  });
}

// Single profile with cache
export function useProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, full_name, avatar_url, current_rating')
        .eq('id', userId)
        .single();
      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!userId,
  });
}
```

---

## Part 5: Optimize Presence Channel

**Problem**: `useGroupPresence` is called in multiple components (`GroupDetail`, `GroupChat`, `GroupMembers`), potentially creating multiple channel subscriptions.

**Solution**: Lift presence to parent level and pass down via context or props.

### Changes

1. **Single subscription**: Call `useGroupPresence` only in `GroupDetail.tsx`
2. **Pass down**: Provide `onlineUsers`, `isOnline`, `onlineCount` as props to child components
3. **Create context (optional)**: For deeply nested components that need presence

```typescript
// GroupDetail.tsx - single source of truth
const presence = useGroupPresence(groupId);

// Pass to children
<GroupChat 
  groupId={groupId!} 
  currentUserId={currentUserId}
  presence={presence}
/>
```

---

## Part 6: Prefetch Group Data on Hover

**Problem**: When navigating from Community list to GroupDetail, there's a loading state while data fetches.

**Solution**: Prefetch group data on hover over group cards.

### Changes to `GroupCard.tsx`

```typescript
import { useQueryClient } from '@tanstack/react-query';

function GroupCard({ group, ... }) {
  const queryClient = useQueryClient();

  const handleMouseEnter = () => {
    // Prefetch posts
    queryClient.prefetchQuery({
      queryKey: ['group-posts', group.id],
      queryFn: () => fetchGroupPosts(group.id),
      staleTime: 30 * 1000,
    });
    
    // Prefetch events
    queryClient.prefetchQuery({
      queryKey: ['group-events', group.id],
      queryFn: () => fetchGroupEvents(group.id),
      staleTime: 60 * 1000,
    });
  };

  return (
    <Card onMouseEnter={handleMouseEnter}>
      ...
    </Card>
  );
}
```

---

## Part 7: Optimize Realtime Subscriptions

**Problem**: Each hook creates its own realtime channel. Multiple channels for the same group.

**Solution**: Consolidate to single group channel with multi-table listening.

### Consolidated Channel Pattern

```typescript
// useGroupRealtime.ts - single channel for all group updates
export function useGroupRealtime(groupId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group_realtime_${groupId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_posts',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['group-posts', groupId] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_events',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['group-events', groupId] });
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['group-messages', groupId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);
}
```

---

## Part 8: Navigation Performance

### Already Good
- Route prefetching on hover in `PlayerShell` ✓
- Code splitting for all pages ✓

### Additional Optimizations

1. **Preload critical routes**: Add link preload hints for common navigation paths

```typescript
// PlayerShell.tsx - preload common routes on mount
useEffect(() => {
  // Preload likely next routes after dashboard
  import('@/pages/player/Community');
  import('@/pages/player/FindEvents');
}, []);
```

2. **Skeleton consistency**: Ensure all loading states use consistent skeleton patterns to reduce layout shift

---

## Implementation Summary

### Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useProfileCache.ts` | Centralized profile caching |
| `src/hooks/useGroupRealtime.ts` | Consolidated realtime subscriptions |

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useGroupPosts.ts` | Convert to React Query |
| `src/hooks/useGroupEvents.ts` | Convert to React Query |
| `src/hooks/useGroupChat.ts` | Convert to React Query |
| `src/hooks/useGroupMembers.ts` | Convert to React Query |
| `src/hooks/useGroups.ts` | Convert to React Query |
| `src/pages/player/GroupDetail.tsx` | Lazy tab rendering, lift presence |
| `src/components/community/GroupFeed.tsx` | Memoize PostCard, use callbacks |
| `src/components/community/GroupCard.tsx` | Add prefetch on hover |
| `src/components/community/GroupSchedule.tsx` | Extract memoized EventCard |
| `src/components/community/GroupMembers.tsx` | Extract memoized MemberCard |
| `src/components/community/GroupChat.tsx` | Accept presence props |
| `src/components/community/ComposerQuickActions.tsx` | Wrap with memo |

---

## Expected Performance Improvements

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Tab switch time | 500-1000ms (refetch) | ~50ms (cached) | 10-20x faster |
| Return to group | Full reload | Instant (cached) | Instant |
| Component re-renders | Every parent render | Only when props change | 50%+ reduction |
| Realtime channels | 3-4 per group | 1 per group | 75% reduction |
| Profile fetches | Multiple per page | 1 per unique user | 80% reduction |

---

## Technical Notes

### React Query Configuration
The app already has reasonable defaults in `App.tsx`:
- `staleTime: 5 * 60 * 1000` (5 minutes)
- `gcTime: 30 * 60 * 1000` (30 minutes)
- `refetchOnWindowFocus: false`

For community data, we'll use shorter stale times (30s-1min) to balance freshness with performance.

### Migration Strategy
1. Start with hooks that have the biggest impact (useGroupPosts, useGroupEvents)
2. Test tab switching before/after each change
3. Add memoization incrementally
4. Consolidate realtime last (requires most careful testing)

