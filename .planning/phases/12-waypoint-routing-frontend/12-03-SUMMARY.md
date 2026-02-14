# Plan 12-03 Summary: Human Verification

**Status:** PASS
**Duration:** Browser testing session
**Commits:** 1755b5d (bug fix found during testing)

## Verification Results

| Test | Result | Notes |
|------|--------|-------|
| 1. Two-point routing unchanged | PASS | Route, directions, summary all work as before |
| 2. Add a waypoint | PASS | Blue numbered marker, 2-leg directions with headers, summary shows leg count |
| 3. Remove a waypoint | PASS | Falls back to regular routing after bug fix |
| 4. Swap button disabled | PASS | Disabled with waypoints, re-enabled without |
| 5. Clear clears everything | PASS | All inputs, markers, routes, waypoints cleared |
| 6. Auto-recalculate on mode switch | PASS | Drive→Bike recalculates through all waypoints |

## Bug Found and Fixed

**Stale waypointRoute data:** When removing a waypoint and clicking Get Directions, the old waypointRoute persisted, causing the UI to show leg-grouped directions for a regular two-point route. Fixed by clearing `setWaypointRoute(null)` in ButtonControls before dispatching to `fetchRoute` (both button click and auto-recalculate effect).

## Minor UX Issue Noted

**Dropdown z-index overlap:** When the To field is empty and shows recent searches while a waypoint search dropdown is open, the To dropdown can overlap the waypoint suggestions. Cosmetic only — filling To before adding a waypoint avoids it. Deferred to future polish.

## Files Changed

- `client/src/components/controls/ButtonControls.tsx` — Clear waypointRoute when dispatching regular route

---
*Verified: 2026-02-14*
