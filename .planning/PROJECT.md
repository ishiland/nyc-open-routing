# NYC Open Routing — UI Redesign

## What This Is

A multi-modal routing app for NYC with an MTA transit-inspired UI — compact, bold, and accessible. Built on pgRouting + LION street network with driving, walking, and biking routes. The interface features mode-specific color accents, responsive layout (desktop sidebar, tablet narrow sidebar, mobile bottom sheet), and WCAG 2.1 AA compliance.

## Core Value

The UI must feel like a native NYC tool — compact, bold, and immediately usable — not a generic maps clone.

## Requirements

### Validated

- ✓ Multi-modal routing (drive, bike, walk) — existing
- ✓ Address search with NYC Geosupport autocomplete — existing
- ✓ Turn-by-turn route display with MapLibre GL — existing
- ✓ Traffic-aware routing toggle (drive mode) — existing
- ✓ Ferry avoidance option — existing
- ✓ URL-based route sharing (deep links) — existing
- ✓ Responsive layout with AdaptiveLayout wrapper — existing
- ✓ Mobile bottom sheet component — existing
- ✓ Error handling with toast notifications — existing
- ✓ MTA transit-inspired design system (colors, typography, spacing) — v1.0
- ✓ Compact sidebar with ToggleButtonGroup mode selector — v1.0
- ✓ Transit-themed search inputs, map controls, and toggles — v1.0
- ✓ Responsive layout: collapsible desktop sidebar, tablet, mobile bottom sheet — v1.0
- ✓ Route display with mode-specific color accents and active step highlighting — v1.0
- ✓ WCAG 2.1 AA compliance (contrast, ARIA, keyboard, focus management) — v1.0

### Active

(None — next milestone requirements defined via `/gsd:new-milestone`)

### Out of Scope

- Backend/API changes — frontend-only redesign, routing logic untouched
- New routing features (new modes, new algorithms) — UI only
- Authentication or user accounts — POC stays anonymous
- Dark mode — shipped one strong identity first
- Custom map tiles/styles — MapLibre base map stays as-is
- Animation libraries (framer-motion, react-spring) — CSS transitions sufficient

## Context

- **Shipped:** v1.0 UI Redesign (2026-02-13)
- **Stack:** React 18 + TypeScript + MUI 7 + MapLibre GL 5 + Vite
- **LOC:** 6,546 TypeScript (client)
- **State management:** React Context API (RoutingContext, MapInstanceContext, MessageContext)
- **Theme:** MTA Blue #0039A6, Inter Variable font, 6px spacing, MODE_COLORS (drive=blue, bike=green, walk=orange)
- **Layout:** AdaptiveLayout (desktop 400px sidebar, tablet 340px, mobile bottom sheet), collapsible to 56px
- **Testing:** 31 tests (13 component + 18 a11y) via Vitest + vitest-axe
- **Codebase map:** `.planning/codebase/` for detailed architecture reference

## Constraints

- **Tech stack**: Must stay within React + MUI + MapLibre GL — no new UI frameworks
- **Functionality**: All existing features must continue to work after redesign
- **Browser support**: Modern browsers only (ESNext target, MapLibre v5 requirement)
- **Performance**: No heavy animation libraries — CSS transitions and MUI built-ins only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MTA transit-inspired visual identity | NYC routing app should feel like NYC — bold, utilitarian, recognizable | ✓ Good — cohesive identity across all components |
| Build on MUI theming (not replace) | MUI 7 already in use, custom theme is lower risk than new library | ✓ Good — single createTheme with cssVariables: true |
| Frontend-only scope | Backend works fine, risk is in the UI layer | ✓ Good — zero backend changes needed |
| No dark mode for v1 | Ship one strong identity first, dark mode adds complexity | ✓ Good — shipped clean light theme |
| Single-pass createTheme | MUI v7 cssVariables incompatible with two-pass pattern | ✓ Good — fixed app crash, now stable |
| MODE_COLORS as exported constant | Direct import simpler than useTheme() for mode colors | ✓ Good — used consistently across 6+ components |
| 6px spacing base | 25% tighter than MUI default 8px for compact transit aesthetic | ✓ Good — compact without feeling cramped |
| vitest-axe for a11y testing | axe-core via existing Vitest setup, no new test runner | ✓ Good — 18 a11y tests, catches regressions |

---
*Last updated: 2026-02-13 after v1.0 milestone*
