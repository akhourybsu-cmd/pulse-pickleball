
# Tournament Notification System Enhancement Plan

## Executive Summary
This plan provides a comprehensive audit of every touchpoint in the tournament system that warrants a notification, proposes the missing notifications to create a complete communication layer, and optimizes the notification center UI for improved usability, visual polish, and navigation.

---

## Part 1: Tournament Notification Audit

### Current State
The system currently sends notifications via:
- **Email only** (through Resend API edge functions)
- Limited in-app notification types (`court_activity`, `event_reminder`)

### Missing In-App Notifications

After analyzing all tournament components, here is a complete inventory of notification-worthy events:

---

### 1. Registration Flow Notifications

| Trigger Point | Notification Type | Priority | Link |
|---------------|-------------------|----------|------|
| Player submits registration | `registration_submitted` | normal | `/tournament/{id}` |
| Registration approved | `registration_approved` | high | `/tournament/{id}` |
| Registration waitlisted | `registration_waitlisted` | normal | `/tournament/{id}` |
| Registration rejected | `registration_rejected` | high | `/tournament/{id}` |
| Promoted from waitlist | `waitlist_promoted` | urgent | `/tournament/{id}` |
| Team assignment confirmed | `team_assigned` | high | `/tournament/{id}/team/{teamId}` |
| Partner added to team | `partner_joined_team` | normal | `/tournament/{id}` |
| Partner left team | `partner_left_team` | high | `/tournament/{id}` |
| Registration cancelled by organizer | `registration_cancelled` | urgent | `/tournaments` |

---

### 2. Tournament Lifecycle Notifications

| Trigger Point | Notification Type | Priority | Link |
|---------------|-------------------|----------|------|
| Tournament published/goes live | `tournament_published` | normal | `/tournament/{id}` |
| Registration opens | `tournament_registration_open` | high | `/tournament/{id}/register` |
| Registration closing soon (24h) | `registration_closing_soon` | high | `/tournament/{id}/register` |
| Registration closed | `tournament_registration_closed` | normal | `/tournament/{id}` |
| Tournament cancelled | `tournament_cancelled` | urgent | `/tournaments` |
| Tournament rescheduled | `tournament_rescheduled` | urgent | `/tournament/{id}` |
| Schedule/brackets released | `schedule_released` | high | `/tournament/{id}` |
| Tournament completed | `tournament_completed` | normal | `/tournament/{id}` |

---

### 3. Match & Competition Notifications

| Trigger Point | Notification Type | Priority | Link |
|---------------|-------------------|----------|------|
| Match scheduled (time assigned) | `match_scheduled` | normal | `/tournament/{id}/division/{divId}` |
| Match starting soon (15 min) | `match_starting_soon` | urgent | `/tournament/{id}/division/{divId}` |
| Match court assigned | `match_court_assigned` | high | `/tournament/{id}/division/{divId}` |
| Match in progress (started) | `match_started` | normal | `/tournament/{id}/live` |
| Match completed (score recorded) | `match_completed` | normal | `/tournament/{id}/division/{divId}` |
| You won your match | `match_won` | normal | `/tournament/{id}` |
| You lost your match | `match_lost` | low | `/tournament/{id}` |
| Score disputed | `match_disputed` | urgent | `/tournament/{id}/division/{divId}` |
| Dispute resolved | `match_dispute_resolved` | high | `/tournament/{id}/division/{divId}` |
| Match forfeited | `match_forfeited` | high | `/tournament/{id}/division/{divId}` |
| Next match ready (after previous completed) | `next_match_ready` | high | `/tournament/{id}/division/{divId}` |

---

### 4. Standings & Results Notifications

| Trigger Point | Notification Type | Priority | Link |
|---------------|-------------------|----------|------|
| You advanced to next round | `advanced_to_next_round` | high | `/tournament/{id}` |
| You're eliminated | `eliminated_from_tournament` | normal | `/tournament/{id}` |
| You placed in top 3 | `podium_finish` | high | `/tournament/{id}` |
| Tournament champion | `tournament_champion` | urgent | `/tournament/{id}` |
| Final standings released | `standings_released` | normal | `/tournament/{id}` |

---

### 5. Check-In & Day-of Notifications

| Trigger Point | Notification Type | Priority | Link |
|---------------|-------------------|----------|------|
| Check-in opens | `checkin_open` | high | `/tournament/{id}` |
| Check-in reminder (30 min before) | `checkin_reminder` | urgent | `/tournament/{id}` |
| Successfully checked in | `checked_in_confirmed` | normal | `/tournament/{id}` |
| Missed check-in deadline | `checkin_missed` | urgent | `/tournament/{id}` |
| Weather delay announcement | `weather_delay` | urgent | `/tournament/{id}` |

---

### 6. Organizer Announcements

| Trigger Point | Notification Type | Priority | Link |
|---------------|-------------------|----------|------|
| General announcement | `tournament_announcement` | high | `/tournament/{id}` |
| Important update | `tournament_update` | urgent | `/tournament/{id}` |
| Schedule change | `schedule_change` | urgent | `/tournament/{id}` |
| Venue change | `venue_change` | urgent | `/tournament/{id}` |

---

### 7. Payment & Financial Notifications

| Trigger Point | Notification Type | Priority | Link |
|---------------|-------------------|----------|------|
| Payment received | `payment_confirmed` | normal | `/tournament/{id}` |
| Payment failed | `payment_failed` | urgent | `/tournament/{id}` |
| Refund processed | `refund_processed` | normal | `/tournaments` |
| Payment reminder (for pending) | `payment_reminder` | high | `/tournament/{id}` |

---

## Part 2: Notification Center UI Optimization

### Current Issues Identified

1. **Navigation**: Clicking a notification marks it as read but doesn't provide visual feedback
2. **Delete UX**: Individual delete requires hover - hard on mobile
3. **Category filtering**: Pills could be more prominent
4. **Empty states**: Generic empty state per category
5. **Link clarity**: No visual indicator that notifications are clickable/actionable
6. **Swipe to delete**: Not available on mobile
7. **Batch selection**: No multi-select for bulk actions
8. **Undo support**: No undo after clearing all

### Proposed UI Enhancements

#### A. Visual Refresh

**NotificationItem.tsx changes:**
- Add a subtle arrow/chevron icon to indicate clickability
- Add swipe-to-delete gesture on mobile (using Framer Motion)
- Show quick delete button always visible (not hover-only)
- Add smooth exit animation when deleted
- Better visual distinction for urgent vs normal priority
- Add category color coding to icon backgrounds

**Styling updates:**
```
Current:                          Proposed:
┌──────────────────────┐        ┌──────────────────────────────┐
│ [Icon] Title         │        │ [Icon] Title            [→] │
│        Message...    │        │        Message...       [X] │
│        2 hours ago   │        │        2 hours ago          │
└──────────────────────┘        └──────────────────────────────┘
```

#### B. Category Tabs Enhancement

- Add "Tournaments" as a dedicated category
- Show category-specific empty states with relevant icons
- Add badge counts on each tab
- Make tabs horizontally scrollable on mobile

**Updated categories:**
```typescript
const categories = [
  { value: "all", label: "All", icon: Bell },
  { value: "tournaments", label: "Tournaments", icon: Trophy },
  { value: "matches", label: "Matches", icon: Target },
  { value: "events", label: "Events", icon: Calendar },
  { value: "community", label: "Social", icon: Users },
  { value: "achievements", label: "Awards", icon: Award },
];
```

#### C. Enhanced Actions Bar

- Add confirmation dialog for "Clear all"
- Add "Undo" toast after delete/clear actions
- Add multi-select mode for batch delete

#### D. Improved Link Handling

- Store structured metadata with proper deep links
- Handle navigation to specific tournament pages, divisions, matches
- Add visual indicator (chevron) for actionable notifications

**Link structure in metadata:**
```typescript
metadata: {
  tournament_id: "uuid",
  division_id: "uuid", 
  match_id: "uuid",
  action: "view_match" | "check_in" | "confirm_spot"
}
```

---

## Part 3: Implementation Details

### New Edge Function: `send-tournament-notification`

A unified edge function that handles all tournament notifications:

**File:** `supabase/functions/send-tournament-notification/index.ts`

```typescript
// Handles all tournament notification types
// Inserts into user_notifications table
// Optionally sends email based on notification type and user preferences
```

**Notification creation pattern:**
```typescript
await supabase.from("user_notifications").insert({
  user_id: recipientId,
  notification_type: "match_starting_soon",
  category: "tournaments",
  priority: "urgent",
  title: "Match Starting Soon!",
  message: `Your match vs ${opponentName} starts in 15 minutes on Court ${courtNumber}`,
  link: `/tournament/${tournamentId}/division/${divisionId}`,
  metadata: {
    tournament_id: tournamentId,
    division_id: divisionId,
    match_id: matchId,
    court_number: courtNumber
  }
});
```

### Database Additions

**New notification types to add to type icons:**
```typescript
const typeIcons: Record<string, React.ElementType> = {
  // Existing
  match_recorded: Target,
  event_reminder: Calendar,
  
  // New Tournament Types
  registration_approved: CheckCircle,
  registration_waitlisted: Clock,
  waitlist_promoted: Star,
  team_assigned: Users,
  match_scheduled: Calendar,
  match_starting_soon: AlertTriangle,
  match_court_assigned: MapPin,
  match_completed: CheckCircle,
  match_disputed: AlertTriangle,
  match_won: Trophy,
  advanced_to_next_round: TrendingUp,
  tournament_champion: Trophy,
  tournament_announcement: Megaphone,
  checkin_open: UserCheck,
  checkin_reminder: Bell,
  payment_confirmed: CreditCard,
  payment_failed: AlertCircle,
  tournament_cancelled: XCircle,
  schedule_released: FileText,
};
```

### Cron Job: Tournament Reminder Scheduler

**File:** `supabase/functions/send-tournament-reminders/index.ts`

Add to config.toml:
```toml
[[edge_runtime.cron]]
name = "send-tournament-reminders"
schedule = "*/5 * * * *"
function_name = "send-tournament-reminders"
```

This function will check for:
- Matches starting in 15 minutes → Send `match_starting_soon`
- Check-in opening in 30 minutes → Send `checkin_reminder`
- Registration closing in 24 hours → Send `registration_closing_soon`

---

## Part 4: Files to Modify/Create

### New Files

| File | Purpose |
|------|---------|
| `supabase/functions/send-tournament-notification/index.ts` | Unified tournament notification sender |
| `supabase/functions/send-tournament-reminders/index.ts` | Cron job for scheduled reminders |
| `src/hooks/useTournamentNotifications.ts` | Hook to trigger notifications from components |

### Modified Files

| File | Changes |
|------|---------|
| `src/components/notifications/NotificationCenter.tsx` | Add tournaments category, improved UI, swipe delete, undo support |
| `src/components/notifications/NotificationItem.tsx` | Add chevron, swipe gesture, category colors, better type icons |
| `src/hooks/useNotifications.ts` | Add undo functionality, tournament category filter |
| `src/components/tournament/RegistrationsPanel.tsx` | Trigger in-app notifications on status changes |
| `src/components/tournament/MatchesPanel.tsx` | Trigger notifications on match start/complete |
| `src/components/tournament/CheckInDashboard.tsx` | Trigger notification on check-in |
| `src/components/tournament/ScoreEntryDialog.tsx` | Trigger match_completed notification |
| `src/components/tournament/DisputeDialog.tsx` | Trigger dispute notifications |
| `supabase/config.toml` | Add tournament reminders cron job |

---

## Part 5: NotificationItem.tsx Enhanced Design

```
┌────────────────────────────────────────────────────────────┐
│ ┌────┐  Match Starting Soon!                      15m  ⌦  │
│ │ 🏆 │  Your match vs Team Alpha starts in 15         →   │
│ │    │  minutes on Court 3                                │
│ └────┘  Tournament: Summer Slam                            │
│         ─────────────────────                              │
│         [Go to Match] [Dismiss]                            │
└────────────────────────────────────────────────────────────┘
```

**Key visual improvements:**
- Icon background color matches category (tournaments = green, matches = blue, etc.)
- Chevron (→) indicates actionable notification
- Swipe left to delete on mobile
- Quick action buttons for common actions
- Timestamp shows relative time + absolute on hover
- Priority stripe on left edge (urgent = red, high = primary, normal = transparent)

---

## Part 6: Navigation Deep Linking

Each notification type maps to a specific destination:

| Notification Type | Destination |
|-------------------|-------------|
| `registration_approved` | `/tournament/{id}` (My Team tab) |
| `match_starting_soon` | `/tournament/{id}/division/{divId}` (Matches tab) |
| `match_court_assigned` | `/tournament/{id}/live` (Live view with court highlighted) |
| `advanced_to_next_round` | `/tournament/{id}` (Bracket view) |
| `tournament_announcement` | `/tournament/{id}` (Info tab) |
| `checkin_open` | `/tournament/{id}` (Check-in modal auto-opens) |
| `payment_failed` | `/tournament/{id}` (Payment section) |

**Navigation handler enhancement:**
```typescript
const handleNotificationClick = (notification: Notification) => {
  markAsRead(notification.id);
  
  // Check for special actions in metadata
  if (notification.metadata?.action === 'check_in') {
    navigate(notification.link);
    // Trigger check-in modal after navigation
    setTimeout(() => window.dispatchEvent(new CustomEvent('open-checkin')), 100);
    return;
  }
  
  if (notification.link) {
    navigate(notification.link);
  }
};
```

---

## Summary

This plan delivers:

1. **38+ new notification types** covering every tournament touchpoint
2. **Enhanced NotificationCenter UI** with categories, swipe-delete, and undo
3. **Deep linking** so every notification takes users exactly where they need to go
4. **Unified edge function** for consistent notification delivery
5. **Cron-based reminders** for time-sensitive notifications
6. **Visual polish** with category colors, priority indicators, and smooth animations

The result is a comprehensive notification system that keeps players informed at every step of their tournament journey, from registration through final results.
