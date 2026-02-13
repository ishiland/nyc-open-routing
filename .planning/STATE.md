# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable
**Current focus:** Phase 2 - Responsive Layout System (complete)

## Current Position

Phase: 2 of 5 (Responsive Layout System)
Plan: 2 of 2 complete
Status: Phase 2 complete
Last activity: 2026-02-13 — Completed 02-02 Sidebar Collapse and Map Controls

Progress: [████░░░░░░] 40%

## Performance Metrics

**Velocity:**
- Total plans completed: 3
- Average duration: ~12 min
- Total execution time: ~0.6 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-design-system-foundation | 1 | ~3 min | ~3 min |
| 02-responsive-layout-system | 2 | ~32 min | ~16 min |

**Recent Trend:**
- Last 5 plans: 01-01 (~3 min), 02-01 (~2 min), 02-02 (~30 min)
- Trend: increasing (02-02 included checkpoint verification with Playwright)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- MTA transit-inspired visual identity chosen for NYC routing app feel (bold, utilitarian, recognizable)
- Build on MUI theming (not replace) — MUI 7 already in use, custom theme is lower risk than new library
- Frontend-only scope — backend works fine, risk is in the UI layer
- No dark mode for v1 — ship one strong identity first, dark mode adds complexity
- MTA Blue (#0039A6) primary, MTA Red (#EE352E) secondary, MTA Orange (#FF6319) accent
- Inter Variable font for clean geometric sans-serif typography
- 6px spacing base (25% tighter than MUI default 8px) for compact transit aesthetic
- MODE_COLORS exported from theme.ts as single source of truth shared between theme.ts and style.ts
- 44px minimum touch targets on interactive elements for accessibility
- All sidebar widths from constants.ts single source of truth (SIDEBAR_WIDTH_PX=400, SIDEBAR_WIDTH_TABLET_PX=340, SIDEBAR_COLLAPSED_WIDTH_PX=56)
- 100dvh for all full-height containers (not 100vh) to handle mobile browser chrome
- MAP_CONTROLS_Z_INDEX=1050 centralized for map control layering
- Belt-and-suspenders backdrop approach: hideBackdrop + slotProps.backdrop.invisible for MUI v5/v7 compat
- [Phase 02]: Sidebar collapses to 56px with overflow:hidden clipping rather than content reflow
- [Phase 02]: map.resize() on transitionend rather than during animation for accurate dimensions
- [Phase 02]: Single-pass createTheme replaces two-pass pattern to fix MUI v7 cssVariables palette crash

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 02-02-PLAN.md (Sidebar Collapse and Map Controls) — Phase 2 complete
Resume file: None

---
*Created: 2026-02-12*
*Last updated: 2026-02-13 after completing 02-02 plan (Phase 2 complete)*
