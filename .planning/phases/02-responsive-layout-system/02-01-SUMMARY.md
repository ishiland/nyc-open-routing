---
phase: 02-responsive-layout-system
plan: 01
subsystem: ui
tags: [react, mui, responsive, mobile, gestures, dvh, constants]

# Dependency graph
requires:
  - phase: 01-design-system-foundation
    provides: MUI theme with MTA design tokens, spacing, and breakpoints
provides:
  - SIDEBAR_WIDTH_PX, SIDEBAR_WIDTH_TABLET_PX, SIDEBAR_COLLAPSED_WIDTH_PX as centralized constants
  - MAP_CONTROLS_Z_INDEX constant for consistent z-index layering
  - 100dvh viewport height for correct mobile browser chrome handling
  - Gesture-isolated BottomSheet with hideBackdrop and pointer-events passthrough
affects: [02-02-PLAN, sidebar-collapse, map-controls, mobile-layout]

# Tech tracking
tech-stack:
  added: []
  patterns: [single-source-of-truth constants for layout dimensions, dvh viewport units, gesture isolation via pointer-events passthrough]

key-files:
  created: []
  modified:
    - client/src/utils/constants.ts
    - client/src/components/layouts/AdaptiveLayout.tsx
    - client/src/components/Sidebar.tsx
    - client/src/components/ControlsContainer.tsx
    - client/src/components/MapLibreGLMap.tsx
    - client/src/components/mobile/BottomSheet.tsx

key-decisions:
  - "SIDEBAR_WIDTH_PX=400 and SIDEBAR_WIDTH_TABLET_PX=340 match existing actual values used in components"
  - "SIDEBAR_COLLAPSED_WIDTH_PX=56 (44px touch target + 6px padding each side) for Plan 02 consumption"
  - "MAP_CONTROLS_Z_INDEX=1050 centralized for consistent map control layering"
  - "Belt-and-suspenders approach: hideBackdrop + slotProps.backdrop.invisible for MUI v5/v7 compat"

patterns-established:
  - "Layout dimension constants: All sidebar widths imported from constants.ts, never hardcoded in components"
  - "Dynamic viewport height: Use 100dvh instead of 100vh for full-height containers"
  - "Gesture isolation: pointer-events none on overlay root, auto on paper, touch-action none on drag handles"

# Metrics
duration: 2min
completed: 2026-02-13
---

# Phase 2 Plan 1: Layout Constants and Gesture Isolation Summary

**Centralized sidebar width constants in constants.ts, replaced 100vh with 100dvh across all layout containers, and hardened BottomSheet with gesture isolation via hideBackdrop and pointer-events passthrough**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-02-13T01:05:26Z
- **Completed:** 2026-02-13T01:07:48Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Consolidated all sidebar width values into constants.ts as single source of truth (SIDEBAR_WIDTH_PX=400, SIDEBAR_WIDTH_TABLET_PX=340, SIDEBAR_COLLAPSED_WIDTH_PX=56)
- Added MAP_CONTROLS_Z_INDEX=1050 constant for Plan 02 consumption
- Replaced all 100vh with 100dvh in AdaptiveLayout (2 instances), Sidebar, ControlsContainer, and MapLibreGLMap
- Hardened BottomSheet with hideBackdrop, pointer-events passthrough, touch-action:none on drag handle, and overscroll-behavior:contain on content

## Task Commits

Each task was committed atomically:

1. **Task 1: Consolidate sidebar width constants and fix viewport height units** - `56424dc` (feat)
2. **Task 2: Harden BottomSheet gesture isolation and map passthrough** - `e534851` (feat)

## Files Created/Modified
- `client/src/utils/constants.ts` - Added SIDEBAR_COLLAPSED_WIDTH_PX, MAP_CONTROLS_Z_INDEX; updated SIDEBAR_WIDTH_PX to 400, SIDEBAR_WIDTH_TABLET_PX to 340
- `client/src/components/layouts/AdaptiveLayout.tsx` - Imported width constants, replaced hardcoded widths and 100vh with 100dvh
- `client/src/components/Sidebar.tsx` - Imported SIDEBAR_WIDTH_PX, replaced hardcoded width and 100vh
- `client/src/components/ControlsContainer.tsx` - Imported SIDEBAR_WIDTH_PX, replaced hardcoded width and 100vh
- `client/src/components/MapLibreGLMap.tsx` - Replaced 100vh with 100dvh
- `client/src/components/mobile/BottomSheet.tsx` - Added hideBackdrop, pointer-events passthrough, touch-action:none, overscroll-behavior:contain, slotProps for MUI v7 compat

## Decisions Made
- SIDEBAR_WIDTH_PX=400 and SIDEBAR_WIDTH_TABLET_PX=340 match the actual values already used in components (not the stale 330/280 that were in constants.ts)
- SIDEBAR_COLLAPSED_WIDTH_PX=56 sized for 44px touch target button + 6px padding each side
- MAP_CONTROLS_Z_INDEX=1050 sits above map (default z) but below bottom sheet (1200)
- Used belt-and-suspenders approach for backdrop: hideBackdrop prop for MUI v5 + slotProps.backdrop.invisible for MUI v7 forward compatibility

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in MapLibreGLMap.tsx line 245 (RouteFeature[] | undefined not assignable to IMapFeature[]) -- confirmed pre-existing via git stash test, not introduced by these changes. Not in scope for this plan.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Width constants ready for Plan 02 (sidebar collapse, map controls repositioning)
- SIDEBAR_COLLAPSED_WIDTH_PX and MAP_CONTROLS_Z_INDEX available for import
- 100dvh ensures correct viewport sizing on mobile before adding responsive features
- BottomSheet gesture isolation complete, no further touch handling needed for Plan 02

## Self-Check: PASSED

- All 7 files verified present on disk
- Both task commits verified in git log (56424dc, e534851)

---
*Phase: 02-responsive-layout-system*
*Completed: 2026-02-13*
