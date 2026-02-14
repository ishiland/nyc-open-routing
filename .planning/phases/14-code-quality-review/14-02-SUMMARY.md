---
phase: 14-code-quality-review
plan: 02
subsystem: ui
tags: [react, typescript, dead-code, KISS, code-quality]

# Dependency graph
requires:
  - phase: 14-01
    provides: "Clean backend code (API, data-importer, scripts)"
provides:
  - "Clean frontend codebase with zero dead code, accurate names, and straightforward control flow"
affects: [15-documentation-deployment, 16-final-qa]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Import canonical types from defining module, not re-exports"
    - "Only export symbols that have external consumers"

key-files:
  created: []
  modified:
    - client/src/types/interfaces.ts
    - client/src/hooks/useGeoJsonLayer.ts
    - client/src/hooks/useLocalStorage.ts
    - client/src/hooks/useResponsive.ts
    - client/src/utils/constants.ts
    - client/src/utils/responsive.ts
    - client/src/utils/style.ts
    - client/src/utils/themeUtils.ts
    - client/src/contexts/RoutingContext.tsx
    - client/src/components/shared/Message.tsx
    - client/src/components/shared/TitleBar.tsx
    - client/src/components/controls/Search.tsx
    - client/src/components/mobile/BottomSheet.tsx

key-decisions:
  - "Left TimeSelector.tsx in place despite being unused in UI (imported by accessibility tests)"
  - "Removed console.log debug statements from useGeoJsonLayer rather than gating behind debug utility"
  - "Removed moveLayer z-order call from useGeoJsonLayer (handled by enforceLayerOrder in MapLibreGLMap)"

patterns-established:
  - "Import MessageContextType from MessageContext.tsx, not interfaces.ts"
  - "Internal-only constants stay non-exported (e.g. trafficColorScale)"

# Metrics
duration: 12min
completed: 2026-02-14
---

# Phase 14 Plan 02: Frontend KISS Cleanup Summary

**Removed 408 lines of dead code across 14 frontend files: unused imports, debug console.logs, commented-out blocks, orphaned exports, and dead state variables**

## Performance

- **Duration:** 12 min
- **Started:** 2026-02-14T21:15:41Z
- **Completed:** 2026-02-14T21:27:46Z
- **Tasks:** 2
- **Files modified:** 14 (10 in Task 1, 4 in Task 2)

## Accomplishments
- Eliminated all dead code from frontend hooks, contexts, utils, and types (281 lines removed)
- Cleaned components of dead state, debug logging, and commented-out blocks (127 lines removed)
- Deleted entire orphaned utils/search.tsx file (all exports unused since SuggestionDropdown rewrite)
- Removed 8 unused constants, 3 unused hooks, 1 unused interface, 1 duplicate type definition
- Cleaned useGeoJsonLayer of verbose console.log debug statements and fixed null paint value handling

## Task Commits

Each task was committed atomically:

1. **Task 1: Audit and clean hooks, contexts, utils, and types** - `b4b4a94` (refactor)
2. **Task 2: Audit and clean components and test files** - `aeaf5e8` (refactor)

## Files Created/Modified

### Deleted
- `client/src/utils/search.tsx` - Entirely dead code (renderInputComponent, renderSuggestion, getSuggestionValue, getAddressLabel all unused)

### Modified (Task 1)
- `client/src/types/interfaces.ts` - Removed unused IRouteData interface, duplicate MessageContextType, replaced default React import with named ReactNode
- `client/src/hooks/useGeoJsonLayer.ts` - Removed 10+ console.log debug statements, removed moveLayer z-order call (now handled centrally), fixed null paint values for addLayer
- `client/src/hooks/useLocalStorage.ts` - Removed unused useEffect import
- `client/src/hooks/useResponsive.ts` - Removed 3 unused hooks (useBreakpointDown, useBreakpointUp, useBreakpointBetween)
- `client/src/utils/themeUtils.ts` - Trimmed from 93 lines to 2 used style objects (formGroup, suggestionItem)
- `client/src/utils/constants.ts` - Removed 8 unused constants (ROUTE_FETCH_TIMEOUT_MS, NYC_SINGLE_POINT_ZOOM, BREAKPOINTS, etc.)
- `client/src/utils/style.ts` - Removed unused routePaint export, made trafficColorScale non-exported
- `client/src/contexts/RoutingContext.tsx` - Removed stale TravelMode migration comment
- `client/src/components/shared/Message.tsx` - Fixed import source for MessageContextType (canonical source)

### Modified (Task 2)
- `client/src/components/mobile/BottomSheet.tsx` - Removed dead sheetHeight variable, dead velocity computation, dead dragStartTime state, unused viewport resize useEffect
- `client/src/components/controls/Search.tsx` - Removed commented-out debug logging block
- `client/src/components/shared/TitleBar.tsx` - Cleaned empty styled component override
- `client/src/utils/responsive.ts` - Trimmed to only getNextSnapPoint export (sole consumer: BottomSheet)

## Decisions Made
- **Left TimeSelector.tsx unchanged** despite not being rendered (replaced by DepartureTimePicker) because it is imported by accessibility tests. Removing would break test coverage.
- **Removed console.log debug statements from useGeoJsonLayer** rather than routing through debug utility -- these were development-time verbose logging, not conditional debug output.
- **Removed moveLayer z-order call** from useGeoJsonLayer because layer ordering is already handled centrally by enforceLayerOrder() in MapLibreGLMap.tsx.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed null paint values passed to addLayer in useGeoJsonLayer**
- **Found during:** Task 1 (useGeoJsonLayer audit)
- **Issue:** `line-dasharray: null` from getModeRoutePaint() was passed to map.addLayer(), which rejects null values in paint objects. Only setPaintProperty accepts null for resets.
- **Fix:** Added cleanPaint filter to strip null values before addLayer call
- **Files modified:** client/src/hooks/useGeoJsonLayer.ts
- **Verification:** Build succeeds, no runtime errors
- **Committed in:** b4b4a94 (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix discovered during audit. No scope creep.

## Issues Encountered
- Task 1 commit was initially lost due to a git staging conflict with concurrent plan execution (api/ files from plan 14-01 were accidentally staged). Resolved by re-staging only the correct frontend files and recommitting.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Frontend codebase is clean and ready for documentation (Phase 15) and final QA (Phase 16)
- All 31 frontend tests pass with zero regressions
- TypeScript build succeeds with no errors

## Self-Check: PASSED

All 13 modified files confirmed present, deleted file confirmed absent, both commit hashes verified in history, SUMMARY.md exists.

---
*Phase: 14-code-quality-review*
*Completed: 2026-02-14*
