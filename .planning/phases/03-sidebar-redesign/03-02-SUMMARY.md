---
phase: 03-sidebar-redesign
plan: 02
subsystem: ui
tags: [mui, react, textfield, slotProps, transit-theme, compact-inputs]

# Dependency graph
requires:
  - phase: 01-design-system-foundation
    provides: MTA transit color palette (primary.main = MTA Blue) and 6px spacing base
  - phase: 03-sidebar-redesign plan 01
    provides: ToggleButtonGroup mode selector replacing AppBar+Tabs
provides:
  - Compact search inputs (size="small", ~40px height) with "From"/"To" labels
  - InputProps migrated to MUI v7 slotProps API
  - Card wrapper removed from sidebar search area
  - Transit-themed MapControls zoom buttons (MTA Blue icon, blue hover fill)
  - Compact 32px swap button
affects: [04-route-display, 05-polish]

# Tech tracking
tech-stack:
  added: []
  patterns: [slotProps migration from deprecated InputProps/inputProps, transit-themed Fab controls]

key-files:
  created: []
  modified:
    - client/src/components/controls/Search.tsx
    - client/src/components/controls/Search.test.tsx
    - client/src/components/Sidebar.tsx
    - client/src/components/controls/MapControls.tsx

key-decisions:
  - "Migrated InputProps/inputProps to slotProps.input/slotProps.htmlInput for MUI v7 compatibility"
  - "Preserved fontSize:16 theme override for iOS Safari zoom prevention (no inline override needed)"
  - "Tests use getByLabelText instead of getByPlaceholderText for resilience to text changes"

patterns-established:
  - "slotProps pattern: Use slotProps.input for InputProps and slotProps.htmlInput for inputProps on MUI TextFields"
  - "Transit Fab pattern: bgcolor background.paper, color primary.main, hover fills with primary.main/contrastText"

# Metrics
duration: 2min
completed: 2026-02-13
---

# Phase 3 Plan 2: Compact Inputs and Transit Controls Summary

**Compact search inputs with size="small" and "From"/"To" labels, slotProps migration, tighter sidebar layout, and MTA Blue-themed zoom controls**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-13T02:08:21Z
- **Completed:** 2026-02-13T02:10:56Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Search inputs reduced from ~56px to ~40px height via size="small" with shorter "From"/"To" labels
- Deprecated InputProps/inputProps migrated to MUI v7 slotProps API
- Card wrapper removed from sidebar search area, saving ~24px of padding
- Swap button compacted from 44px to 32px with smaller icon
- MapControls zoom buttons styled with MTA Blue icon color and blue hover fill
- All tests updated to use getByLabelText queries and pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Compact search inputs and fix test expectations** - `3145f4b` (feat)
2. **Task 2: Tighten Sidebar spacing and apply transit theme to MapControls** - `d888efb` (feat)

## Files Created/Modified
- `client/src/components/controls/Search.tsx` - Added size="small", "From"/"To" labels, shortened placeholder, migrated to slotProps
- `client/src/components/controls/Search.test.tsx` - Updated queries from getByPlaceholderText to getByLabelText
- `client/src/components/Sidebar.tsx` - Removed Card wrapper, compacted swap button to 32px, tightened spacing to 1.5
- `client/src/components/controls/MapControls.tsx` - Added primary.main icon color, divider border, primary.main hover fill with contrastText

## Decisions Made
- Migrated InputProps/inputProps to slotProps.input/slotProps.htmlInput for MUI v7 forward compatibility
- iOS Safari zoom prevention preserved via existing theme-level fontSize:16 override (no per-component fix needed)
- Tests switched to getByLabelText for resilience against placeholder/label text changes

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in MapLibreGLMap.tsx (RouteFeature[] | undefined not assignable to IMapFeature[]) causes `tsc` to fail. This is unrelated to plan changes and was present before execution. Vite build succeeds (runtime-safe). Not a blocker.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Search inputs and sidebar layout are compact and transit-themed
- MapControls match the MTA visual identity
- Ready for route display and polish phases
- Pre-existing tsc error in MapLibreGLMap.tsx should be addressed in a future plan

## Self-Check: PASSED

All 4 modified files verified on disk. Both task commits (3145f4b, d888efb) verified in git log.

---
*Phase: 03-sidebar-redesign*
*Completed: 2026-02-13*
