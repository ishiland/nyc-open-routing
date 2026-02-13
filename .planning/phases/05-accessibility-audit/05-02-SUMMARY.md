---
phase: 05-accessibility-audit
plan: 02
subsystem: testing
tags: [vitest-axe, axe-core, wcag, accessibility, a11y, contrast-ratio, keyboard-navigation]

# Dependency graph
requires:
  - phase: 05-01
    provides: "WCAG 2.1 AA accessibility fixes (ARIA labels, contrast, keyboard support, focus management)"
provides:
  - "Automated axe-core audit tests for 5 key components"
  - "WCAG AA contrast ratio assertions for all MODE_COLORS"
  - "BottomSheet keyboard navigation tests (ArrowUp/ArrowDown)"
  - "Sidebar focus management test (collapse moves focus to expand button)"
  - "vitest-axe test infrastructure with WCAG 2.1 AA configuration"
affects: []

# Tech tracking
tech-stack:
  added: [vitest-axe, axe-core]
  patterns: [a11y-test-setup, axe-audit-per-component, contrast-ratio-assertion, keyboard-event-testing]

key-files:
  created:
    - client/src/__tests__/accessibility/a11y.setup.ts
    - client/src/__tests__/accessibility/aria-labels.test.tsx
    - client/src/__tests__/accessibility/contrast-audit.test.tsx
    - client/src/__tests__/accessibility/keyboard-focus.test.tsx
    - client/src/__tests__/accessibility/vitest-axe.d.ts
  modified:
    - client/package.json
    - client/src/components/controls/TrafficToggle.tsx
    - client/src/components/controls/FerryToggle.tsx
    - client/src/components/controls/TimeSelector.tsx

key-decisions:
  - "slotProps.input replaces deprecated inputProps on MUI v7 Switch components for ARIA labels"
  - "Explicit labelId on TimeSelector Select for axe-core compliance in jsdom"
  - "import * as vitestAxeMatchers pattern for expect.extend compatibility with vitest mockReset"
  - "fireEvent.click instead of userEvent.click for fake-timer-compatible sidebar focus test"

patterns-established:
  - "a11y test setup: configureAxe with color-contrast disabled and WCAG 2.1 AA runOnly tags"
  - "Contrast ratio assertion: relativeLuminance + contrastRatio utility for theme color verification"
  - "Mock pattern: vi.mocked(hook).mockImplementation in beforeEach for mockReset compatibility"

# Metrics
duration: 10min
completed: 2026-02-13
---

# Phase 5 Plan 2: Accessibility Test Suite Summary

**vitest-axe automated WCAG 2.1 AA tests covering axe-core audits, ARIA label verification, contrast ratio assertions, and keyboard/focus management across 5 components**

## Performance

- **Duration:** 10 min
- **Started:** 2026-02-13T12:07:49Z
- **Completed:** 2026-02-13T12:18:22Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments
- Installed vitest-axe with configureAxe setup for WCAG 2.1 AA (color-contrast disabled for jsdom)
- 10 aria-labels tests: axe-core audits + accessible name assertions for TrafficToggle, FerryToggle, InfoModal, TravelModeSelect, TimeSelector
- 4 contrast tests: WCAG AA 4.5:1 ratio verification for drive (MTA blue + white), bike (dark green + white), walk (dark orange + black)
- 4 keyboard/focus tests: BottomSheet ArrowUp/ArrowDown snap point changes, ARIA slider attributes, sidebar collapse focus management

## Task Commits

Each task was committed atomically:

1. **Task 1: Install vitest-axe and create a11y test setup** - `407693f` (chore)
2. **Task 2: Write ARIA labels, contrast, and keyboard/focus tests** - `db465e6` (test)

## Files Created/Modified
- `client/src/__tests__/accessibility/a11y.setup.ts` - vitest-axe configuration with WCAG 2.1 AA rules
- `client/src/__tests__/accessibility/aria-labels.test.tsx` - axe-core audits and ARIA name verification for 5 components
- `client/src/__tests__/accessibility/contrast-audit.test.tsx` - MODE_COLORS contrast ratio assertions against WCAG AA
- `client/src/__tests__/accessibility/keyboard-focus.test.tsx` - BottomSheet keyboard navigation and sidebar focus management
- `client/src/__tests__/accessibility/vitest-axe.d.ts` - TypeScript declarations for toHaveNoViolations matcher
- `client/package.json` - Added vitest-axe devDependency
- `client/src/components/controls/TrafficToggle.tsx` - Fixed inputProps to slotProps.input
- `client/src/components/controls/FerryToggle.tsx` - Fixed inputProps to slotProps.input
- `client/src/components/controls/TimeSelector.tsx` - Added explicit labelId for Select accessibility

## Decisions Made
- Used `slotProps.input` instead of deprecated `inputProps` on MUI v7 Switch (inputProps is not functional in v7.3.5)
- Added explicit `labelId` on TimeSelector Select to link label and combobox for axe-core in jsdom
- Used `import * as vitestAxeMatchers` for `expect.extend` compatibility (vitest mockReset clears extensions from named imports)
- Used `fireEvent.click` instead of `userEvent.click` in fake-timer sidebar test to avoid async timer deadlock

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Switch aria-label not rendering in MUI v7**
- **Found during:** Task 2 (ARIA labels tests)
- **Issue:** MUI v7.3.5 Switch ignores `inputProps` prop entirely -- the `aria-label` was never rendered on the input element
- **Fix:** Changed TrafficToggle and FerryToggle from `inputProps={{ "aria-label": "..." }}` to `slotProps={{ input: { "aria-label": "..." } }}`
- **Files modified:** client/src/components/controls/TrafficToggle.tsx, client/src/components/controls/FerryToggle.tsx
- **Verification:** axe-core audit passes, getByLabelText finds the elements
- **Committed in:** db465e6 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed TimeSelector Select missing accessible name**
- **Found during:** Task 2 (axe-core audit on TimeSelector)
- **Issue:** MUI Select combobox had no accessible name because InputLabel and Select were not explicitly linked via id/labelId in jsdom
- **Fix:** Added `id="traffic-day-of-week-label"` on InputLabel and `labelId="traffic-day-of-week-label"` on Select
- **Files modified:** client/src/components/controls/TimeSelector.tsx
- **Verification:** axe-core aria-input-field-name rule passes
- **Committed in:** db465e6 (Task 2 commit)

**3. [Rule 3 - Blocking] Added vitest-axe TypeScript declarations**
- **Found during:** Task 2 (TypeScript check)
- **Issue:** `tsc --noEmit` failed with "Property 'toHaveNoViolations' does not exist on type 'Assertion'"
- **Fix:** Created `vitest-axe.d.ts` augmenting vitest's Assertion interface with AxeMatchers
- **Files modified:** client/src/__tests__/accessibility/vitest-axe.d.ts
- **Verification:** `tsc --noEmit` passes with zero errors
- **Committed in:** db465e6 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** All fixes necessary for correctness. The Switch inputProps bug was a real accessibility issue from Plan 01 that MUI v7 API change exposed. No scope creep.

## Issues Encountered
- vitest-axe `extend-expect.js` was an empty file (0 bytes), so the documented `import "vitest-axe/extend-expect"` pattern did not register matchers -- worked around with explicit `expect.extend` call
- vitest `mockReset: true` config resets `expect.extend` registrations between tests -- resolved by using `import * as` namespace import which survives reset

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 5 accessibility work complete (Plan 01 fixes + Plan 02 tests)
- 18 new a11y tests providing regression coverage for WCAG 2.1 AA compliance
- All 31 tests pass, zero TypeScript errors

## Self-Check: PASSED

All 6 created files verified present. Both task commits (407693f, db465e6) verified in git log.

---
*Phase: 05-accessibility-audit*
*Completed: 2026-02-13*
