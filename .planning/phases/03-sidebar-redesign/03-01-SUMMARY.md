---
phase: 03-sidebar-redesign
plan: 01
subsystem: ui
tags: [mui, toggle-button, sidebar, compact-layout, react]

# Dependency graph
requires:
  - phase: 01-design-system-foundation
    provides: MODE_COLORS, MTA color constants, 6px spacing base, 44px touch targets
provides:
  - ToggleButtonGroup-based travel mode selector with mode-specific colors
  - Compact inline toggle rows for traffic and ferry options
  - Tightened TitleBar (40px) and ControlsContainer spacing
  - MuiToggleButton and MuiToggleButtonGroup theme overrides
affects: [03-sidebar-redesign]

# Tech tracking
tech-stack:
  added: []
  patterns: [ToggleButtonGroup for exclusive mode selection, inline Switch+icon+label toggle rows]

key-files:
  created: []
  modified:
    - client/src/components/controls/TravelModeSelect.tsx
    - client/src/components/controls/TrafficToggle.tsx
    - client/src/components/controls/FerryToggle.tsx
    - client/src/components/shared/TitleBar.tsx
    - client/src/components/ControlsContainer.tsx
    - client/src/utils/theme.ts

key-decisions:
  - "ToggleButtonGroup with exclusive prop replaces AppBar+Tabs for travel mode selection"
  - "MODE_COLORS drives selected button background color dynamically per mode"
  - "Inline Switch+icon+label pattern replaces FormControlLabel for compact toggle rows"
  - "Existing MuiTab theme overrides retained for backward compatibility"

patterns-established:
  - "ToggleButtonGroup exclusive with null-guard onChange for single-selection UI"
  - "Compact inline toggle: Box flex row with Switch size=small + icon + Typography caption"
  - "Mode-specific styling via sx with Mui-selected class selector and MODE_COLORS"

# Metrics
duration: 2min
completed: 2026-02-13
---

# Phase 3 Plan 1: Compact Sidebar Header Summary

**ToggleButtonGroup mode selector with mode-specific colors, inline toggle rows, and 40px TitleBar replacing vertically-spread AppBar+Tabs header**

## Performance

- **Duration:** 2 min
- **Started:** 2026-02-13T02:08:20Z
- **Completed:** 2026-02-13T02:10:55Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Replaced AppBar+Tabs (64px) with compact ToggleButtonGroup (44px) showing mode-specific selected colors (drive=blue, bike=green, walk=orange)
- Compacted TrafficToggle and FerryToggle from bordered full-row FormControlLabel (~40px each) to inline flex rows (~28px) with Switch+icon+label
- Reduced TitleBar from 48px/20px-font to 40px/16px-font with tighter padding
- Restructured ControlsContainer with grouped controls area and tighter children padding

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace AppBar+Tabs with ToggleButtonGroup in TravelModeSelect and add theme overrides** - `9d052f2` (feat)
2. **Task 2: Compact toggles, TitleBar, and restructure ControlsContainer layout** - `f41931b` (feat)

## Files Created/Modified
- `client/src/components/controls/TravelModeSelect.tsx` - Full rewrite: ToggleButtonGroup with MODE_COLORS selected state and null-guard deselection prevention
- `client/src/components/controls/TrafficToggle.tsx` - Compact inline row with Switch+TrafficIcon+label, removed borderBottom and FormControlLabel
- `client/src/components/controls/FerryToggle.tsx` - Compact inline row with Switch+BoatIcon+label, removed borderBottom and FormControlLabel
- `client/src/components/shared/TitleBar.tsx` - Reduced minHeight 48->40px, padding 16->12px, fontSize 20->16px
- `client/src/components/ControlsContainer.tsx` - Wrapped controls in grouped Box(px:1.5,pt:1), reduced children padding from 2 to 1.5
- `client/src/utils/theme.ts` - Added MuiToggleButton (44px, focus-visible ring) and MuiToggleButtonGroup overrides

## Decisions Made
- Used ToggleButtonGroup with exclusive prop instead of Tabs -- semantically correct for mode selection (not navigation), more compact
- Applied mode-specific color via sx `& .Mui-selected` selector with MODE_COLORS[mode] -- dynamic per active mode
- Kept existing MuiTab theme overrides in theme.ts rather than removing them -- no conflict, may be used elsewhere
- Used inline Switch+icon+label pattern rather than FormControlLabel -- 28px vs 40px height, cleaner flex layout

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in MapLibreGLMap.tsx (RouteFeature[] | undefined not assignable to IMapFeature[]) prevents `tsc && vite build` from completing, but this is unrelated to the sidebar changes. Individual file type-checking confirms no errors in modified files.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Sidebar header is compact and transit-themed, ready for Plan 02 (compact search inputs and map controls)
- All existing functionality preserved: mode switching, traffic/ferry toggle visibility by mode, TitleBar with InfoModal
- All 13 tests pass with no regressions

## Self-Check: PASSED

All 7 files verified present. Both task commits (9d052f2, f41931b) confirmed in git log.

---
*Phase: 03-sidebar-redesign*
*Completed: 2026-02-13*
