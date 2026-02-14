# NYC Open Routing

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
- ✓ Collapse button repositioned below TitleBar, no info button overlap — v1.1
- ✓ Deep link mode parameter correctly restored on page load — v1.1
- ✓ Mobile autocomplete visible above bottom sheet (z-index fix) — v1.1
- ✓ Collapsed sidebar icon rail with travel mode indicator and tooltips — v1.1
- ✓ Empty state "Get started" hint when no route calculated — v1.1
- ✓ Map controls render immediately with disabled placeholders — v1.1
- ✓ Isochrone SQL functions using pgr_drivingDistance + ST_ConcaveHull for drive/bike/walk modes — v2.0
- ✓ Isochrone API endpoint returning concentric time-band polygons — v2.0
- ✓ Frontend reachability mode with Route/Isochrone toggle, fill polygon map layers — v2.0
- ✓ Traffic-aware isochrones for drive mode — v2.0
- ✓ Turn restriction rewrite covering all edge-node combinations (35,454 restrictions) — v2.0
- ✓ Centralized map layer z-ordering with enforceLayerOrder — v2.0

### Active

- [ ] Departure time picker for traffic-aware routing and isochrones

### Out of Scope

- Authentication or user accounts — POC stays anonymous
- Dark mode — shipped one strong identity first
- Custom map tiles/styles — MapLibre base map stays as-is
- Animation libraries (framer-motion, react-spring) — CSS transitions sufficient

## Context

- **Current Milestone:** v2.1 Departure Time — "Leave at" time picker for traffic-aware routing and isochrones
- **Shipped:** v2.0 Isochrone Reachability (2026-02-14), v1.1 UI Polish (2026-02-13), v1.0 UI Redesign (2026-02-13)
- **Stack:** React 18 + TypeScript + MUI 7 + MapLibre GL 5 + Vite
- **LOC:** 6,613 TypeScript (client)
- **State management:** React Context API (RoutingContext, MapInstanceContext, MessageContext)
- **Theme:** MTA Blue #0039A6, Inter Variable font, 6px spacing, MODE_COLORS (drive=blue, bike=green, walk=orange)
- **Layout:** AdaptiveLayout (desktop 400px sidebar, tablet 340px, mobile bottom sheet), collapsible to 56px with icon rail
- **Z-index hierarchy:** map controls 1050 < bottom sheet 1200 < dropdown 1210
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
| Collapse button at top:48 | 40px TitleBar height + 8px gap, avoids z-index overlap | ✓ Good — clean separation from header controls |
| isInitialized ref guard for URL sync | Prevents URL update effect from overwriting deep link params during mount | ✓ Good — eliminates race condition cleanly |
| DROPDOWN_Z_INDEX = 1210 | Sits above bottom sheet (1200) and map controls (1050) | ✓ Good — mobile autocomplete now visible |
| disablePortal on Popper | Avoids iOS Safari stacking context clipping in SwipeableDrawer | ✓ Good — dropdown stays within drawer DOM tree |
| Icon rail in collapsed sidebar | Shows current mode at a glance; reads RoutingContext directly | ✓ Good — collapsed state now informative |
| Disabled placeholder pattern for MapControls | Render controls immediately with disabled state, enable when map loads | ✓ Good — eliminates pop-in flash |

---
*Last updated: 2026-02-14 after v2.1 milestone start*
