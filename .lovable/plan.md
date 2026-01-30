

## Add Friends & Private Messaging + Fix Group Name Display

### Overview
This plan adds two major social features to the Community tab: a **Friend System** for connecting with players and **Private Messaging (DMs)** for 1-on-1 conversations. Additionally, we'll fix the group name truncation issue on the Discover tab so all names are fully visible.

---

### Part 1: Fix Group Name Truncation on Discover Tab

**The Issue:** Group names on the Discover tab are currently truncated with ellipses due to the `truncate` CSS class on line 96 of `GroupCard.tsx`.

**Solution:** Allow names to wrap across multiple lines instead of truncating.

**Changes:**
- `src/components/community/GroupCard.tsx` - Remove `truncate` class, add `line-clamp-2 break-words` to allow up to 2 lines
- `src/components/community/ReorderableGroupList.tsx` - Apply same fix for consistency

---

### Part 2: Friend System

#### Database Tables Required

**Table: `friendships`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | The user who sent the request |
| friend_id | uuid | The user receiving the request |
| status | enum | 'pending', 'accepted', 'blocked' |
| created_at | timestamp | When request was sent |
| accepted_at | timestamp | When accepted (nullable) |

**Unique constraint:** Prevent duplicate friendships in either direction

#### Features
1. **Send Friend Request** - From player profiles or member lists
2. **Accept/Decline Requests** - In a dedicated "Friend Requests" section
3. **View Friends List** - New tab or section in Community
4. **Remove Friend** - Option in friend settings
5. **Block User** - Prevent further requests

#### UI Components

**New Files:**
- `src/hooks/useFriends.ts` - Hook for friend CRUD operations
- `src/components/community/FriendsTab.tsx` - Friends list display
- `src/components/community/FriendCard.tsx` - Individual friend card
- `src/components/community/FriendRequestsSection.tsx` - Pending requests
- `src/components/community/AddFriendDialog.tsx` - Search and add friends
- `src/components/community/FriendProfileCard.tsx` - Quick profile view with actions

**Modified Files:**
- `src/pages/player/Community.tsx` - Add "Friends" tab alongside Groups/Discover/Activity
- `src/components/community/GroupMembers.tsx` - Add "Add Friend" button to member cards

---

### Part 3: Private Messaging (DMs)

#### Database Tables Required

**Table: `conversations`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| created_at | timestamp | When conversation started |
| updated_at | timestamp | Last activity |

**Table: `conversation_participants`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| conversation_id | uuid | FK to conversations |
| user_id | uuid | FK to profiles |
| joined_at | timestamp | When joined |
| last_read_at | timestamp | For unread tracking |

**Table: `direct_messages`**
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| conversation_id | uuid | FK to conversations |
| sender_id | uuid | FK to profiles |
| content | text | Message content |
| created_at | timestamp | When sent |

**Enable realtime:** `ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;`

#### Features
1. **Start DM** - From friend card, member list, or profile
2. **DM Inbox** - List of all conversations with unread counts
3. **Real-time Chat** - Same quality as group chat
4. **Typing Indicators** - Reuse existing infrastructure
5. **Online Status** - Show if friend is online

#### UI Components

**New Files:**
- `src/hooks/useDirectMessages.ts` - DM conversation management
- `src/hooks/useConversation.ts` - Single conversation state
- `src/pages/player/DirectMessages.tsx` - DM inbox/list page
- `src/pages/player/DirectMessageChat.tsx` - Individual DM conversation
- `src/components/community/DMInbox.tsx` - Conversation list
- `src/components/community/DMConversationCard.tsx` - Conversation preview
- `src/components/community/DMChat.tsx` - Chat interface (reuses ChatMessage.tsx)
- `src/components/community/StartDMButton.tsx` - Quick action to start DM

**Modified Files:**
- `src/pages/player/Community.tsx` - Add "Messages" access point
- `src/components/community/FriendCard.tsx` - Add "Message" button
- `src/components/community/GroupMembers.tsx` - Add "Message" action
- `src/App.tsx` - Add routes for `/player/messages` and `/player/messages/:conversationId`

---

### Part 4: Community Tab Layout Update

The Community tab header will be enhanced with a quick-access DM icon:

```
┌─────────────────────────────────────────────────────────┐
│  Community                              [✉️] [+] [Code] │
├─────────────────────────────────────────────────────────┤
│  [Groups] [Friends] [Discover] [Activity]               │
└─────────────────────────────────────────────────────────┘
```

**New "Friends" Tab Content:**
- Friend requests section (if any pending)
- Online friends first (sorted by last active)
- Quick actions: Message, View Profile, Remove

**DM Icon Badge:**
- Shows total unread DM count
- Tapping opens `/player/messages`

---

### Technical Implementation Details

#### Database Migration

```sql
-- Create friendships table
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  friend_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(user_id, friend_id),
  CHECK (user_id != friend_id)
);

-- Create conversations table
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create conversation participants
CREATE TABLE public.conversation_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Create direct messages table
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Enable realtime for DMs
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- RLS Policies (participants can view/send in their conversations)
CREATE POLICY "Users can view their friendships" ON public.friendships
  FOR SELECT USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can create friend requests" ON public.friendships
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their friendships" ON public.friendships
  FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = friend_id);

CREATE POLICY "Users can view their conversations" ON public.conversation_participants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view messages in their conversations" ON public.direct_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can send messages to their conversations" ON public.direct_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    conversation_id IN (
      SELECT conversation_id FROM public.conversation_participants WHERE user_id = auth.uid()
    )
  );
```

#### useFriends Hook Structure

```typescript
export function useFriends() {
  // State
  const [friends, setFriends] = useState<FriendWithProfile[]>([]);
  const [pendingRequests, setPendingRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Actions
  const sendFriendRequest = async (friendId: string) => {...};
  const acceptRequest = async (friendshipId: string) => {...};
  const declineRequest = async (friendshipId: string) => {...};
  const removeFriend = async (friendshipId: string) => {...};
  const blockUser = async (userId: string) => {...};
  
  return { friends, pendingRequests, loading, sendFriendRequest, ... };
}
```

#### useDirectMessages Hook Structure

```typescript
export function useDirectMessages() {
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  
  const startConversation = async (userId: string) => {...};
  const getOrCreateConversation = async (userId: string) => {...};
  
  return { conversations, loading, startConversation, ... };
}

export function useConversation(conversationId: string) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Realtime subscription for new messages
  // Reuse typing indicator logic from useTypingIndicator
  
  const sendMessage = async (content: string) => {...};
  const markAsRead = async () => {...};
  
  return { messages, loading, sendMessage, markAsRead };
}
```

---

### File Summary

#### New Files (17 files)
| File | Purpose |
|------|---------|
| `src/hooks/useFriends.ts` | Friend system state management |
| `src/hooks/useDirectMessages.ts` | DM list/inbox management |
| `src/hooks/useConversation.ts` | Single DM conversation state |
| `src/components/community/FriendsTab.tsx` | Friends list in Community tab |
| `src/components/community/FriendCard.tsx` | Individual friend display |
| `src/components/community/FriendRequestsSection.tsx` | Pending request handling |
| `src/components/community/AddFriendDialog.tsx` | Search and add friends UI |
| `src/components/community/StartDMButton.tsx` | Quick DM action button |
| `src/components/community/DMInbox.tsx` | Conversation list component |
| `src/components/community/DMConversationCard.tsx` | Conversation preview card |
| `src/components/community/DMChat.tsx` | DM chat interface |
| `src/pages/player/DirectMessages.tsx` | DM inbox page |
| `src/pages/player/DirectMessageChat.tsx` | Individual DM page |

#### Modified Files (6 files)
| File | Changes |
|------|---------|
| `src/components/community/GroupCard.tsx` | Remove truncation, allow name wrapping |
| `src/components/community/ReorderableGroupList.tsx` | Remove truncation, allow name wrapping |
| `src/pages/player/Community.tsx` | Add Friends tab, DM icon in header |
| `src/components/community/GroupMembers.tsx` | Add Friend/Message actions |
| `src/App.tsx` | Add DM routes |
| `src/components/community/index.ts` | Export new components |

---

### User Experience Flow

**Adding a Friend:**
1. View member in group → Tap their profile
2. See "Add Friend" button → Tap to send request
3. Friend receives notification/sees pending request
4. Friend accepts → Both are now connected
5. Both can now DM each other

**Starting a DM:**
1. From Friends tab → Tap "Message" on friend card
2. OR from member list → Tap profile → "Message"
3. Opens DM chat (creates conversation if new)
4. Real-time messaging with typing indicators
5. Back button returns to inbox

**DM Inbox Experience:**
- Sorted by most recent activity
- Shows unread count per conversation
- Shows friend's online status
- Preview of last message
- Tap to open conversation

