# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable
**Current focus:** Phase 3 - Sidebar Redesign (complete)

## Current Position

Phase: 3 of 5 (Sidebar Redesign)
Plan: 2 of 2 complete
Status: Phase 3 complete
Last activity: 2026-02-13 — Completed 03-02 Compact Inputs and Transit Controls

Progress: [█████░░░░░] 50%

## Performance Metrics

**Velocity:**
- Total plans completed: 5
- Average duration: ~8 min
- Total execution time: ~0.7 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-design-system-foundation | 1 | ~3 min | ~3 min |
| 02-responsive-layout-system | 2 | ~32 min | ~16 min |
| 03-sidebar-redesign | 2 | ~4 min | ~2 min |

**Recent Trend:**
- Last 5 plans: 01-01 (~3 min), 02-01 (~2 min), 02-02 (~30 min), 03-01 (~2 min), 03-02 (~2 min)
- Trend: stable (03-02 compact inputs and transit controls, straightforward styling)

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
- [Phase 03]: ToggleButtonGroup with exclusive prop replaces AppBar+Tabs for travel mode selection
- [Phase 03]: MODE_COLORS drives selected button background color dynamically per mode
- [Phase 03]: Inline Switch+icon+label pattern replaces FormControlLabel for compact toggle rows
- [Phase 03]: slotProps.input/slotProps.htmlInput replaces deprecated InputProps/inputProps on MUI TextFields
- [Phase 03]: Transit Fab pattern: white bg, primary.main icon, hover fills primary.main with contrastText
- [Phase 03]: Tests use getByLabelText over getByPlaceholderText for resilience

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 03-02-PLAN.md (Compact Inputs and Transit Controls) — Phase 3 complete
Resume file: None

---
*Created: 2026-02-12*
*Last updated: 2026-02-13 after completing 03-02 plan (Phase 3 complete)*
