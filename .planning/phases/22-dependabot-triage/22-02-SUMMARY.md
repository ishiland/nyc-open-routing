---
phase: 22-dependabot-triage
plan: 02
subsystem: infra
tags: [eslint, typescript-eslint, react-hooks, dependabot, npm, lockfile]

# Dependency graph
requires:
  - phase: none
    provides: n/a
provides:
  - Modern ESLint config with typescript-eslint + react-hooks (no CRA dependency)
  - Clean package-lock.json without phantom CRA-era transitive deps
  - Zero critical/high npm audit vulnerabilities
affects: [client-tooling, ci]

# Tech tracking
tech-stack:
  added: ["@typescript-eslint/eslint-plugin@^7", "@typescript-eslint/parser@^7", "eslint-plugin-react-hooks@^5", "eslint-plugin-react-refresh@^0.4"]
  patterns: ["Direct ESLint plugin dependencies instead of meta-config packages"]

key-files:
  created: []
  modified:
    - client/.eslintrc.json
    - client/package.json
    - client/package-lock.json
    - client/src/hooks/useDebouncedFetch.ts

key-decisions:
  - "Replaced eslint-config-react-app with direct typescript-eslint + react-hooks plugins"
  - "Dropped eslint-plugin-import and eslint-plugin-react to minimize transitive deps"
  - "Set @typescript-eslint/no-explicit-any to off (codebase uses any in map types and event handlers)"
  - "Added react-refresh/only-export-components for Vite HMR compatibility"

patterns-established:
  - "Direct ESLint plugin deps: avoid meta-config packages that pull outdated transitive deps"

# Metrics
duration: 3min
completed: 2026-02-15
---

# Phase 22 Plan 02: ESLint CRA Migration Summary

**Replaced eslint-config-react-app with direct typescript-eslint/recommended + react-hooks/recommended, regenerated lockfile eliminating ~102 phantom Dependabot alerts**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-15T18:37:47Z
- **Completed:** 2026-02-15T18:40:14Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Removed eslint-config-react-app and all its outdated transitive dependencies (old TypeScript-ESLint, Jest plugins, etc.)
- Rewrote .eslintrc.json with modern parser, typescript-eslint/recommended, react-hooks/recommended, and prettier
- Regenerated package-lock.json, removing phantom CRA-era entries (webpack-dev-server, loader-utils, react-scripts)
- npm audit: 0 critical, 0 high vulnerabilities (4 moderate from esbuild/vite dev chain only)
- All 31 tests pass, build succeeds, lint clean (0 errors, 5 expected react-refresh context warnings)

## Task Commits

Each task was committed atomically:

1. **Task 1: Replace ESLint config and update dependencies** - `5d5e96e` (feat)
2. **Task 2: Regenerate lockfile and verify everything works** - `9867efc` (chore)

## Files Created/Modified
- `client/.eslintrc.json` - Modern ESLint config with typescript-eslint parser, recommended rules, react-hooks, react-refresh
- `client/package.json` - Removed eslint-config-react-app, added 4 direct ESLint plugin dependencies
- `client/package-lock.json` - Regenerated fresh, eliminating phantom CRA-era transitive deps
- `client/src/hooks/useDebouncedFetch.ts` - Fixed prefer-const lint error (let -> const for timeoutId)

## Decisions Made
- Used @typescript-eslint v7 (latest compatible with eslint 8) rather than v8 (which requires eslint 9 flat config)
- Dropped eslint-plugin-import entirely (import/imports-first, import/newline-after-import, import/prefer-default-export rules removed) to avoid transitive dep bloat
- Dropped eslint-plugin-react entirely (jsx-filename-extension, prop-types, destructuring-assignment rules removed -- TypeScript handles JSX/props validation)
- Set @typescript-eslint/no-explicit-any to off since codebase uses any for MapLibre GL types and event handlers
- Added ignorePatterns for dist/ and *.config.* to avoid lint noise on build output and config files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed prefer-const lint error in useDebouncedFetch.ts**
- **Found during:** Task 2 (lint verification)
- **Issue:** New @typescript-eslint/recommended config flagged `let timeoutId` that is only assigned once as a prefer-const error
- **Fix:** Moved declaration to assignment site: `const timeoutId = setTimeout(fetchData, delay)`
- **Files modified:** client/src/hooks/useDebouncedFetch.ts
- **Verification:** `npm run lint:check` passes with 0 errors
- **Committed in:** 9867efc (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Minor code quality fix caught by stricter new ESLint config. No scope creep.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- ESLint config modernized and working
- Lockfile clean, ready for Dependabot to re-evaluate (should see significant reduction in alerts)
- Remaining 4 moderate audit items are esbuild/vite dev-chain only, fixable when vite v7 is adopted

## Self-Check: PASSED

All files verified present. All commits verified in git log.

---
*Phase: 22-dependabot-triage*
*Completed: 2026-02-15*
