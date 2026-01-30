
## Community Tab Social Enhancement Plan

### Executive Summary
This plan transforms the Community tab into a polished, social-first experience that feels like a native messaging app. We'll implement real-time presence indicators, typing indicators, rich messaging features, and visual micro-interactions that make the platform intuitive, useful, and engaging.

---

### Current State Analysis

After a detailed code audit, here's what exists:

| Feature | Status | Notes |
|---------|--------|-------|
| Real-time chat messages | Implemented | Uses Supabase realtime subscriptions |
| Post reactions | Implemented | Emoji reactions with counts |
| Comments on posts | Implemented | Threaded replies supported |
| Unread badges | Implemented | Per-group unread counts |
| Group member list | Implemented | With roles displayed |
| Presence system | Exists elsewhere | `CourtPresence.tsx` uses Supabase presence |

**Missing Social Features:**
- No typing indicators in chat
- No online/offline presence for group members
- No "last seen" timestamps
- No message read receipts
- No quick emoji reactions for chat messages
- No @mentions with notifications
- No animated message transitions
- No link previews
- No haptic-style micro-interactions

---

### Enhancement Categories

## 1. Real-Time Presence System

**Goal:** Show who's online in each group

**Implementation:**
- Create `useGroupPresence.ts` hook using Supabase Presence API
- Display green online indicator dots on member avatars
- Show "X members online" in group header
- Track `online_at` timestamp for "last seen" display

```typescript
// Pattern from existing CourtPresence.tsx
const channel = supabase.channel(`group-presence-${groupId}`)
  .on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    // Update online members
  })
  .subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.track({ user_id, online_at: new Date().toISOString() });
    }
  });
```

**UI Changes:**
- `GroupChat.tsx`: Add "X online" indicator in header
- `GroupMembers.tsx`: Show green dot on online member avatars
- `GroupSnapshot.tsx`: Add online member count

---

## 2. Typing Indicators

**Goal:** Show when someone is typing in chat

**Implementation:**
- Use Supabase Broadcast for ephemeral typing state
- Debounce typing events (300ms)
- Auto-clear after 3 seconds of inactivity
- Show animated typing bubble

```typescript
// Broadcast typing status
channel.send({
  type: 'broadcast',
  event: 'typing',
  payload: { user_id, display_name }
});
```

**UI Component:** `TypingIndicator.tsx`
- Three animated dots
- Shows "John is typing..." or "John and 2 others are typing..."
- Positioned just above the message input

---

## 3. Enhanced Chat Experience

**Goal:** Make chat feel fluid and responsive

### Message Transitions
- Add subtle slide-in animations for new messages
- Animate message sending state (optimistic UI)
- Smooth scroll-to-bottom behavior

### Quick Emoji Reactions for Chat
- Long-press/double-tap on message to show emoji picker
- Show small reaction pills below messages
- Animate reaction additions

### Message Grouping
- Group consecutive messages from same user
- Show timestamp only for first message in group
- Smart time separators ("Today", "Yesterday", "Monday")

### Read Indicators
- Track `last_read_at` per user
- Show "Seen by X" for own messages (optional)

---

## 4. Rich Content Features

### @Mentions System
- Type `@` to trigger member autocomplete
- Highlight mentioned names in messages
- Store mentions for notification system (future)

### Link Previews
- Detect URLs in messages
- Show preview card with title, description, image
- Use existing fetch/parse utilities

### Media Quick Actions
- Add camera icon for quick photo (placeholder for now)
- GIF picker button (future)

---

## 5. Visual Micro-Interactions

**Goal:** Premium, native-app feel

| Element | Animation |
|---------|-----------|
| Send button | Scale + ripple on tap |
| Message bubble | Slide-in from right (own) or left (others) |
| Reactions | Pop + wiggle when added |
| Typing dots | Wave animation (sequential bounce) |
| Online indicator | Gentle pulse |
| New message badge | Subtle bounce |

**Implementation:**
- Use Framer Motion for complex animations
- CSS transitions for simple states
- 60fps performance target

---

## 6. Feed Enhancements

### Improved Post Composer
- Expand smoothly on focus
- Show character count
- Persist draft on navigation (optional)

### Reaction Feedback
- Animate emoji when toggled
- Show brief "+1" toast for new reactions on your posts

### Comment Sheet Improvements
- Smoother slide-up animation
- Auto-focus input when opened
- Show comment preview before opening

---

### Technical Implementation

#### New Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/useGroupPresence.ts` | Real-time presence tracking |
| `src/hooks/useTypingIndicator.ts` | Typing state management |
| `src/components/community/TypingIndicator.tsx` | Typing dots UI |
| `src/components/community/OnlineIndicator.tsx` | Green dot component |
| `src/components/community/ChatMessage.tsx` | Enhanced message bubble |
| `src/components/community/MessageReactions.tsx` | Quick reactions for chat |
| `src/components/community/MentionAutocomplete.tsx` | @mention picker |

#### Files to Modify

| File | Changes |
|------|---------|
| `src/components/community/GroupChat.tsx` | Add presence, typing, animations, enhanced UX |
| `src/components/community/GroupFeed.tsx` | Add micro-interactions to reactions, improved composer |
| `src/components/community/GroupMembers.tsx` | Add online indicators |
| `src/components/community/GroupSnapshot.tsx` | Show online count |
| `src/pages/player/GroupDetail.tsx` | Integrate presence system |
| `src/hooks/useGroupChat.ts` | Add typing broadcast, message animations support |

---

### Detailed Component Changes

#### GroupChat.tsx Enhanced

```text
┌─────────────────────────────────────────────────────────┐
│  Chat            ● 3 online                             │  ← Online count
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌──── Today ────┐                                     │  ← Smart date separator
│                                                         │
│        ┌─────────────────────────────────┐             │
│        │  Anyone up for 3pm today?       │  ← Own msg │
│        └─────────────────────────────────┘  10:42 AM  │
│                                                         │
│  ┌─────────────────────────────────────┐               │
│  │  I'm in! Meet at court 3?           │  ← Other msg │
│  └─────────────────────────────────────┘  👍 2        │  ← Reactions
│                                           Sarah • 10:43│
│                                                         │
│  ┌─────────────────────────────────────┐               │
│  │ ● ● ●                               │  ← Typing    │
│  │ John is typing...                   │               │
│  └─────────────────────────────────────┘               │
│                                                         │
├─────────────────────────────────────────────────────────┤
│  [😊] Type a message...                         [📷][➤]│  ← Enhanced input
└─────────────────────────────────────────────────────────┘
```

---

### Animation Specifications

**Message Send Animation:**
```css
@keyframes message-slide-in {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}
/* Duration: 200ms, ease-out */
```

**Typing Indicator Dots:**
```css
@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}
/* Staggered: 0ms, 150ms, 300ms */
```

**Reaction Pop:**
```css
@keyframes reaction-pop {
  0% { transform: scale(0); }
  50% { transform: scale(1.3); }
  100% { transform: scale(1); }
}
/* Duration: 300ms, spring-like */
```

---

### Presence Hook Design

```typescript
// useGroupPresence.ts
export function useGroupPresence(groupId: string) {
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [onlineProfiles, setOnlineProfiles] = useState<Profile[]>([]);
  
  useEffect(() => {
    const channel = supabase.channel(`group-presence-${groupId}`, {
      config: { presence: { key: 'user_id' } }
    });
    
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const userIds = Object.values(state).flat().map(p => p.user_id);
        setOnlineUsers(userIds);
        fetchProfiles(userIds);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await channel.track({ user_id: user.id });
          }
        }
      });
      
    return () => supabase.removeChannel(channel);
  }, [groupId]);
  
  return { onlineUsers, onlineProfiles, isOnline: (userId) => onlineUsers.includes(userId) };
}
```

---

### Typing Indicator Hook Design

```typescript
// useTypingIndicator.ts
export function useTypingIndicator(groupId: string, channelRef: MutableRefObject<RealtimeChannel | null>) {
  const [typingUsers, setTypingUsers] = useState<{id: string, name: string}[]>([]);
  
  // Clear stale typing states after 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingUsers(prev => prev.filter(u => u.timestamp > Date.now() - 3000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  const startTyping = useCallback(debounce((userId, displayName) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { user_id: userId, display_name: displayName }
    });
  }, 300), []);
  
  return { typingUsers, startTyping };
}
```

---

### Performance Considerations

1. **Presence Optimization**
   - Only track presence when user is actively viewing group
   - Unsubscribe on tab switch/navigation
   - Debounce presence updates

2. **Message Rendering**
   - Virtualize long message lists (if >100 messages)
   - Lazy load images/link previews
   - Use React.memo for message components

3. **Animation Performance**
   - Use CSS transforms (GPU accelerated)
   - Avoid layout thrashing
   - will-change hints for animated elements

---

### Implementation Phases

**Phase 1: Foundation (This Implementation)**
- Real-time presence system
- Typing indicators
- Message animations
- Online indicators in members list
- Enhanced input bar

**Phase 2: Rich Content (Future)**
- @mentions with autocomplete
- Link previews
- Image attachments
- GIF support

**Phase 3: Notifications (Future)**
- Push notifications for mentions
- Unread badges with badge API
- Sound effects (optional)

---

### User Experience Summary

After implementation, the Community tab will:

- Show who's online in each group with real-time green dots
- Display "John is typing..." when members compose messages
- Animate messages smoothly as they appear
- Feel responsive with instant send feedback
- Support quick emoji reactions on chat messages
- Look and feel like a premium native messaging app
- Operate quickly with optimized rendering and animations

---

### Success Metrics

| Metric | Target |
|--------|--------|
| Message send latency | < 100ms perceived |
| Animation frame rate | 60 fps |
| Presence update delay | < 500ms |
| Typing indicator accuracy | 95%+ |
| Time to first interaction | < 2s |
