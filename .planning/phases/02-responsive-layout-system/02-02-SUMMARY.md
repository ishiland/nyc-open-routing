---
phase: 02-responsive-layout-system
plan: 02
subsystem: ui
tags: [react, mui, responsive, sidebar, collapse, css-transition, map-controls, z-index, mobile]

# Dependency graph
requires:
  - phase: 02-responsive-layout-system/02-01
    provides: SIDEBAR_WIDTH_PX, SIDEBAR_WIDTH_TABLET_PX, SIDEBAR_COLLAPSED_WIDTH_PX, MAP_CONTROLS_Z_INDEX constants and dvh viewport units
  - phase: 01-design-system-foundation
    provides: MUI theme with MTA design tokens, breakpoints, and spacing
provides:
  - Collapsible desktop sidebar with 250ms CSS transition and map resize on transitionend
  - Responsive map control positioning (ZoomToRouteButton above mobile bottom sheet)
  - Centralized z-index usage across all map control components
  - Accessible collapse toggle with 44px touch target and aria-label
affects: [03-sidebar-redesign, mobile-layout, map-controls]

# Tech tracking
tech-stack:
  added: []
  patterns: [CSS transition with transitionend callback for layout resize, responsive positioning via useResponsive hook, centralized z-index from constants]

key-files:
  created: []
  modified:
    - client/src/components/layouts/AdaptiveLayout.tsx
    - client/src/components/Sidebar.tsx
    - client/src/components/ControlsContainer.tsx
    - client/src/components/controls/MapControls.tsx
    - client/src/components/controls/ZoomToRouteButton.tsx
    - client/src/utils/theme.ts

key-decisions:
  - "Sidebar collapses to SIDEBAR_COLLAPSED_WIDTH_PX (56px) with overflow:hidden to clip content rather than reflow"
  - "map.resize() called on transitionend event to avoid measuring during animation"
  - "ZoomToRouteButton uses calc(40% + 16px) bottom offset on mobile to sit above collapsed bottom sheet snap point"
  - "Single-pass createTheme replaces two-pass pattern to fix MUI v7 cssVariables palette resolution"

patterns-established:
  - "Transition-driven resize: Use CSS transition + transitionend callback for smooth layout changes that require map recalculation"
  - "Responsive control positioning: Use useResponsive hook with calc() offsets to avoid overlap with mobile bottom sheet"

# Metrics
duration: ~30min
completed: 2026-02-13
---

# Phase 2 Plan 2: Sidebar Collapse and Map Controls Summary

**Collapsible desktop sidebar with 250ms CSS transition, map resize on transitionend, and responsive ZoomToRouteButton positioning above mobile bottom sheet**

## Performance

- **Duration:** ~30 min (includes checkpoint verification via Playwright browser automation at 3 breakpoints)
- **Started:** 2026-02-13T01:15:00Z
- **Completed:** 2026-02-13T01:45:03Z
- **Tasks:** 3 (2 auto + 1 checkpoint)
- **Files modified:** 6

## Accomplishments
- Added collapsible sidebar to desktop/tablet layout with smooth 250ms CSS transition between full width and 56px collapsed strip
- Wired map.resize() on transitionend so the map fills freed space without white gaps
- Replaced all hardcoded z-index:1000 in MapControls and ZoomToRouteButton with centralized MAP_CONTROLS_Z_INDEX constant
- Made ZoomToRouteButton responsive: positioned above collapsed bottom sheet on mobile via calc(40% + 16px) bottom offset
- Verified all breakpoints via Playwright: desktop (1280x800), tablet (700x800), mobile (390x844)

## Task Commits

Each task was committed atomically:

1. **Task 1: Add collapsible sidebar to desktop layout with CSS transition** - `cd3cd48` (feat)
2. **Task 2: Reposition map controls for responsive layout awareness** - `d61c43d` (feat)
3. **Task 3: Verify responsive layout behaviors** - N/A (checkpoint, verified via Playwright)

## Files Created/Modified
- `client/src/components/layouts/AdaptiveLayout.tsx` - Added isCollapsed state, transitionend handler calling map.resize(), collapse toggle IconButton with ChevronLeft/ChevronRight, inner width wrapper to prevent content reflow
- `client/src/components/Sidebar.tsx` - Removed hardcoded `<aside>` wrapper since AdaptiveLayout now provides the collapsible container
- `client/src/components/ControlsContainer.tsx` - Changed Paper width from SIDEBAR_WIDTH_PX to 100% and height from 100dvh to 100% to defer sizing to parent
- `client/src/components/controls/MapControls.tsx` - Replaced hardcoded zIndex:1000 with MAP_CONTROLS_Z_INDEX from constants
- `client/src/components/controls/ZoomToRouteButton.tsx` - Added useResponsive hook, responsive bottom offset for mobile, centralized z-index, smooth transition on bottom property
- `client/src/utils/theme.ts` - Rewrote from two-pass createTheme to single-pass to fix MUI v7 cssVariables palette crash

## Decisions Made
- Sidebar collapses to 56px (SIDEBAR_COLLAPSED_WIDTH_PX) with overflow:hidden clipping rather than content reflow animation -- simpler and avoids layout thrash during transition
- map.resize() fires on transitionend rather than during transition to get accurate final dimensions
- ZoomToRouteButton uses calc(40% + 16px) on mobile to match the 0.4 snap point of the BottomSheet plus padding
- theme.ts rewritten from two-pass createTheme (base theme + augmentColor) to single-pass createTheme with manually specified accent color to fix MUI v7 cssVariables palette resolution crash (reading undefined .main/.light on palette colors)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed MUI v7 cssVariables palette crash in theme.ts**
- **Found during:** Task 3 (checkpoint verification via Playwright)
- **Issue:** MUI v7's cssVariables mode requires all palette colors to be fully resolved in a single createTheme call. The existing two-pass pattern (create base theme, then augmentColor in second pass) left palette.accent undefined during CSS variable generation, causing "Cannot read properties of undefined (reading 'main')" crash.
- **Fix:** Collapsed theme.ts to single createTheme call with accent color manually specified as a full palette entry (main, light, dark, contrastText) instead of using augmentColor.
- **Files modified:** client/src/utils/theme.ts
- **Verification:** App loads without crash at all breakpoints; palette colors render correctly
- **Committed in:** db1e1c5

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for app to render. No scope creep.

## Issues Encountered
- Pre-existing TypeScript error in MapLibreGLMap.tsx (RouteFeature[] | undefined not assignable to IMapFeature[]) continues from Plan 01 -- confirmed not introduced by these changes, not in scope.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Phase 2 (Responsive Layout System) is now complete: all success criteria met
- Desktop sidebar collapse/expand, mobile bottom sheet with gesture isolation, responsive map controls all working
- Ready for Phase 3 (Sidebar Redesign) which builds on the responsive layout foundation
- All layout constants, z-index values, and breakpoint handling established for Phase 3 consumption

## Self-Check: PASSED

- All 6 modified files verified present on disk
- All 3 task commits verified in git log (cd3cd48, d61c43d, db1e1c5)

---
*Phase: 02-responsive-layout-system*
*Completed: 2026-02-13*
