# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-12)

**Core value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable
**Current focus:** Phase 5 - Accessibility Audit (complete)

## Current Position

Phase: 5 of 5 (Accessibility Audit)
Plan: 2 of 2 complete
Status: All phases complete
Last activity: 2026-02-13 — Completed 05-02 Accessibility Test Suite

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: ~7 min
- Total execution time: ~0.95 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-design-system-foundation | 1 | ~3 min | ~3 min |
| 02-responsive-layout-system | 2 | ~32 min | ~16 min |
| 03-sidebar-redesign | 2 | ~4 min | ~2 min |
| 04-route-display-polish | 1 | ~3 min | ~3 min |
| 05-accessibility-audit | 2 | ~12 min | ~6 min |

**Recent Trend:**
- Last 5 plans: 03-01 (~2 min), 03-02 (~2 min), 04-01 (~3 min), 05-01 (~2 min), 05-02 (~10 min)
- Trend: stable (05-02 a11y test suite with vitest-axe, 18 new tests)

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
- [Phase 04]: MODE_COLORS[mode] used consistently for border, icon, chip, and step highlight colors
- [Phase 04]: Hex alpha suffix (14/1F) for subtle tinted backgrounds on active step
- [Phase 04]: TurnIcon default color changed to inherit to allow sx color override
- [Phase 04]: maxZoom: 17 default caps fitBounds zoom level (~1-2 blocks of context)
- [Phase 05]: Black text (#000) on walk mode orange (#E65100) for 5.53:1 contrast ratio (WCAG AA)
- [Phase 05]: role=slider instead of role=button on BottomSheet drag handle (continuous range control)
- [Phase 05]: 260ms focus timeout (10ms after 250ms CSS transition) for post-transition focus management
- [Phase 05]: slotProps.input replaces deprecated inputProps on MUI v7 Switch for ARIA labels
- [Phase 05]: Explicit labelId on Select components for axe-core jsdom compatibility

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

## Session Continuity

Last session: 2026-02-13
Stopped at: Completed 05-02-PLAN.md (Accessibility Test Suite) — All phases complete
Resume file: None

---
*Created: 2026-02-12*
*Last updated: 2026-02-13 after completing 05-02 plan*
