---
phase: 04-route-display-polish
plan: 01
subsystem: ui
tags: [react, mui, mode-colors, turn-by-turn, map-zoom, active-step]

# Dependency graph
requires:
  - phase: 01-design-system-foundation
    provides: MODE_COLORS export from theme.ts
  - phase: 03-sidebar-redesign
    provides: RouteSummaryCard, RouteList, TurnIcon components
provides:
  - Mode-specific color accents on RouteSummaryCard (border, icon, traffic chip)
  - Active step highlighting with mode-colored left border and tinted background
  - Mode-specific turn icon colors in turn-by-turn list
  - maxZoom cap on fitBounds preventing over-zoom on short segments
  - Automatic selectedStreet clearing on route recalculation
affects: [05-map-interaction-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "MODE_COLORS[mode] pattern for dynamic color accents across route display"
    - "Mui-selected override with hex alpha suffix for mode-tinted backgrounds"
    - "maxZoom option in useMapZoom to cap zoom on fitBounds"

key-files:
  created: []
  modified:
    - client/src/components/controls/RouteSummaryCard.tsx
    - client/src/components/controls/RouteList.tsx
    - client/src/components/shared/TurnIcon.tsx
    - client/src/hooks/useMapZoom.ts
    - client/src/hooks/useRouteFetch.ts
    - client/src/components/controls/ButtonControls.tsx
    - client/src/components/RouteStateManager.tsx
    - client/src/components/MapLibreGLMap.tsx

key-decisions:
  - "MODE_COLORS[mode] used consistently for border, icon, chip, and step highlight colors"
  - "Hex alpha suffix (14/1F) for subtle tinted backgrounds on active step"
  - "TurnIcon default color changed to inherit to allow sx color override"
  - "maxZoom: 17 default caps fitBounds zoom level (~1-2 blocks of context)"

patterns-established:
  - "MODE_COLORS[mode] for all mode-dependent color accents in route display"
  - "Mui-selected sx override with mode-colored border and tinted background"

# Metrics
duration: 3min
completed: 2026-02-13
---

# Phase 4 Plan 1: Route Display Polish Summary

**Mode-specific color accents on route card/list, active step highlighting with tinted backgrounds, maxZoom cap on segment zoom, and auto-clear of selected step on route change**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-13T02:27:39Z
- **Completed:** 2026-02-13T02:31:11Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- RouteSummaryCard dynamically colors border, mode icon, and traffic chip per travel mode using MODE_COLORS
- RouteList turn-by-turn steps show mode-specific icon colors and active step highlighting with tinted background and left border
- Map zoom capped at level 17 on fitBounds to prevent over-zoom on short street segments
- Selected step automatically clears when a new route is calculated

## Task Commits

Each task was committed atomically:

1. **Task 1: RouteSummaryCard mode-specific colors** - `a9c3d70` (feat)
2. **Task 2: RouteList active step highlighting and mode colors** - `9c336e0` (feat)
3. **Task 3: Zoom maxZoom cap and clear selectedStreet** - `076236a` (feat)

**Auto-fix commit:** `2c28533` (fix: pre-existing TS narrowing in MapLibreGLMap)

## Files Created/Modified
- `client/src/components/controls/RouteSummaryCard.tsx` - MODE_COLORS for border, icon, traffic chip
- `client/src/components/controls/RouteList.tsx` - Active step highlighting, mode icon colors, typography hierarchy
- `client/src/components/shared/TurnIcon.tsx` - Default color changed to "inherit" for sx override
- `client/src/hooks/useMapZoom.ts` - Added maxZoom option (default 17) to fitBounds
- `client/src/hooks/useRouteFetch.ts` - Clear selectedStreet on successful route calculation
- `client/src/components/controls/ButtonControls.tsx` - Wire setSelectedStreet to useRouteFetch
- `client/src/components/RouteStateManager.tsx` - Wire setSelectedStreet to useRouteFetch
- `client/src/components/MapLibreGLMap.tsx` - Fix pre-existing TS narrowing error in route features closure

## Decisions Made
- MODE_COLORS[mode] used consistently across all mode-dependent color accents
- Hex alpha suffix approach (14 = 8% opacity, 1F = 12%) for subtle step tinting
- TurnIcon default changed from "action" to "inherit" so sx color takes precedence
- maxZoom default of 17 chosen for 1-2 blocks of visual context on short segments

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added setSelectedStreet to RouteStateManager**
- **Found during:** Task 3 (useRouteFetch interface change)
- **Issue:** RouteStateManager.tsx also calls useRouteFetch but plan only mentioned ButtonControls; TS compile failed
- **Fix:** Added setSelectedStreet to RouteStateManager context destructuring and useRouteFetch call
- **Files modified:** client/src/components/RouteStateManager.tsx
- **Verification:** TypeScript compiles, all tests pass
- **Committed in:** 076236a (part of Task 3 commit)

**2. [Rule 3 - Blocking] Fixed pre-existing TypeScript narrowing error in MapLibreGLMap**
- **Found during:** Overall verification (build step)
- **Issue:** `route.features` type not narrowed inside closure callback, blocking `npm run build`
- **Fix:** Extracted `route.features` to local `features` variable before closure for proper TS narrowing
- **Files modified:** client/src/components/MapLibreGLMap.tsx
- **Verification:** Build succeeds, all tests pass
- **Committed in:** 2c28533

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for compilation. No scope creep.

## Issues Encountered
None beyond the auto-fixed blocking issues above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Route display polish complete with mode-specific colors throughout
- Active step interaction feedback ready for map interaction polish phase
- maxZoom cap provides foundation for refined segment zoom behavior

## Self-Check: PASSED

All 8 modified files verified on disk. All 4 commit hashes (a9c3d70, 9c336e0, 076236a, 2c28533) found in git log.

---
*Phase: 04-route-display-polish*
*Completed: 2026-02-13*
