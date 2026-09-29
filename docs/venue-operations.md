# Venue operations and attendance

Venue administration uses a persistent console across settings, operations, event management, round robins, leagues and owner payment tools. On wide screens the left navigation and content scroll independently; mobile keeps a horizontal section navigator.

## Running the day

1. Open Operations and choose the venue-local operating date. The check-in desk lists every overlapping scheduled event once, even when it occupies several courts.
2. Search by event or player, select the event, and check in confirmed players. Rosters show only first name and last initial. Waitlists and unconfirmed payments cannot be checked in.
3. Switch to Court calendar to see rentals and allocated event space. Select an event block to open its attendance roster. Both views keep the same date in the URL.
4. After an event ends, mark individual no-shows or use Close attendance to review and mark everyone still unmarked. Undo resets a record; checking in a no-show corrects a late arrival.
5. Daily report downloads event totals as CSV. Totals count registrations, so one player attending two events counts twice. Canceled events are excluded from totals. Historical dates remain available.

Open staff kiosk expands the desk, hides admin navigation and requests browser fullscreen when supported. Exit kiosk restores the console. It is an attended staff view using the signed-in operator's access, not a public self-service session.

## Data and access

The registration remains the attendance authority. Check-in and no-show changes increment an attendance version and write an audit record with the operator and time. Concurrent stale edits and stale bulk close requests are rejected. Canceling or refunding a registration clears its current attendance while retaining the audit record. Attendance changes do not rebuild round-robin rosters.

Venue owners, managers and organizers retain event attendance access. Active front-desk staff with facility tools can operate attendance without receiving event editing or payment permissions. Required MFA is enforced in the attendance RPCs. The day endpoint projects only roster initials, attendance state, court names and schedule details; no email, contact information or payment amounts. Anonymous access is denied.

The desk refreshes every 15 seconds and after each change. A failed refresh hides stale rosters and blocks actions until attendance can be verified again. No offline writes are queued.
