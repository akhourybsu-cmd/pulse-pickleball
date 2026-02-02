
# Player Side Analysis - Issues & Fixes

## Critical Issue Found: App Crashing 🔴

The console logs reveal a **critical runtime error**:
```
ReferenceError: CourtConnector is not defined
```

### Root Cause
The previous cleanup removed the lazy import for `CourtConnector` from App.tsx (line removed), but the route `/player/courts` still references the `PlayerCourts` component which re-exports `CourtConnector`:

```typescript
// src/pages/player/PlayerCourts.tsx
export { default } from '../CourtConnector';
```

Since the `CourtConnector` lazy import was removed but the route and re-export still exist, the app crashes on load.

---

## Summary of Issues

| Category | Issue | Severity | Files Affected |
|----------|-------|----------|----------------|
| **Critical** | App crashes - `CourtConnector` undefined | 🔴 Critical | `App.tsx`, `PlayerCourts.tsx` |
| **Navigation** | Legacy `/dashboard` navigations | 🟡 Medium | 15+ files |
| **Navigation** | Legacy `/court/connector` links | 🟡 Medium | 3 files (FAQ, CourtSettings, CourtBoard) |
| **Cleanup** | Orphaned `CourtConnector.tsx` | 🟢 Low | 1 file |

---

## Detailed Fixes Required

### Fix 1: Remove Broken Player Courts Route (Critical)

Since we're archiving Court Connector functionality:

1. **Remove the route** from App.tsx:
   - Delete: `<Route path="courts" element={<PlayerCourts />} />`
   
2. **Delete orphaned files**:
   - `src/pages/player/PlayerCourts.tsx` (re-export wrapper)
   - Consider archiving `src/pages/CourtConnector.tsx`

3. **Remove the lazy import** for PlayerCourts from App.tsx:
   - Delete: `const PlayerCourts = lazy(() => import("./pages/player/PlayerCourts"));`

### Fix 2: Update Legacy Navigation References

Update these files to use `/player/dashboard` instead of `/dashboard`:

| File | Line | Current | Fix |
|------|------|---------|-----|
| `MatchWizardContainer.tsx` | 182 | `navigate('/dashboard')` | `navigate('/player/dashboard')` |
| `onboarding/Complete.tsx` | 34 | `navigate("/dashboard")` | `navigate("/player/dashboard")` |
| `ViewProfile.tsx` | 61, 93 | `navigate("/dashboard")` | `navigate("/player/dashboard")` |
| `MatchHistory.tsx` | 502 | `navigate("/dashboard")` | `navigate("/player/dashboard")` |
| `CourtHistory.tsx` | 75 | `navigate("/dashboard")` | `navigate("/player/dashboard")` |
| `EditProfile.tsx` | 891 | `navigate("/dashboard")` | `navigate("/player/dashboard")` (Cancel button) |
| `TournamentLanding.tsx` | 176, 799 | `/dashboard` | `/player/dashboard` |
| `AdminDashboard.tsx` | 60, 139 | `/dashboard` | `/player/dashboard` |
| `AdminBadges.tsx` | 88 | `/dashboard` | `/player/dashboard` |
| `AdminMarketing.tsx` | 49 | `/dashboard` | `/player/dashboard` |
| `AdminAuditLog.tsx` | 82 | `/dashboard` | `/player/dashboard` |
| `AdminVenueVerification.tsx` | 84 | `/dashboard` | `/player/dashboard` |
| `AdminBiometrics.tsx` | 51, 59 | `/dashboard` | `/player/dashboard` |
| `Kiosk.tsx` | 87, 105 | `/dashboard` | `/player/dashboard` |

### Fix 3: Update Court Connector References

Update these files to remove or redirect `/court/connector` links:

| File | Change |
|------|--------|
| `FAQ.tsx` | Remove or update Court Connector reference |
| `CourtSettings.tsx` | Change navigation to `/player/community` or remove |
| `CourtBoard.tsx` | Update fallback navigation |

---

## Files to Delete (Archiving Court Connector)

- `src/pages/player/PlayerCourts.tsx` - orphaned re-export
- Consider archiving: `src/pages/CourtConnector.tsx`, `src/pages/CourtBoard.tsx`, `src/pages/CourtHistory.tsx`, `src/pages/CourtSettings.tsx`

---

## Working Features Verified ✅

| Feature | Status | Notes |
|---------|--------|-------|
| Dashboard (`/player/dashboard`) | ✅ Works | ProfileHero, PerformanceModule rendering correctly |
| Find Events (`/player/find`) | ✅ Works | UnifiedEventCard, filters operational |
| My Events (`/player/my-events`) | ✅ Works | Registration cards, cancel flow |
| My Bookings (`/player/my-bookings`) | ✅ Works | Booking cards, cancel flow |
| Community (`/player/community`) | ✅ Works | Groups, Friends tabs functional |
| Friends Presence | ✅ Works | `useFriendsPresence` hook integrated |
| Group Detail (`/player/community/group/:id`) | ✅ Works | Presence, chat, feed functional |
| Direct Messages | ✅ Works | Conversation list, real-time chat |
| Venue Discovery (`/player/venues`) | ✅ Works | Search, favorites, detail sheet |
| Match Recording | ✅ Works | MatchWizard flow (nav needs fix) |
| Profile Edit | ✅ Works | Form saves correctly (nav needs fix) |

---

## Implementation Order

1. **Fix Critical App Crash** (Priority 1)
   - Remove PlayerCourts route and import from App.tsx
   
2. **Update Navigation References** (Priority 2)
   - Batch update all `/dashboard` → `/player/dashboard`
   
3. **Clean Up Court Connector References** (Priority 3)
   - Update FAQ, CourtSettings, CourtBoard
   
4. **Archive Legacy Files** (Priority 4)
   - Delete/archive CourtConnector-related files

---

## Technical Notes

- The redirect from `/dashboard` to `/player/dashboard` in App.tsx (line 289) provides a safety net, but direct navigations still cause unnecessary redirects
- The N+1 query optimizations in `useFriends.ts` are properly implemented with batched `.in()` queries
- Friends presence integration in `FriendsTab.tsx` is now correctly wired up via `useFriendsPresence`
- All player shell header rules are correctly applied (hidden on dashboard, visible elsewhere)
