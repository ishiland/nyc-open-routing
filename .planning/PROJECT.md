# NYC Open Routing

## What This Is

A multi-modal routing app for NYC with an MTA transit-inspired UI — compact, bold, and accessible. Built on pgRouting + LION street network with driving, walking, biking routes, isochrone reachability analysis (polygon and edge-based), multi-stop waypoint routing, and traffic-aware routing. The interface features mode-specific color accents, responsive layout (desktop sidebar, tablet narrow sidebar, mobile bottom sheet), and WCAG 2.1 AA compliance.

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
- ✓ Departure time picker with day/hour selection for traffic-aware routing — v2.1
- ✓ API integration passing hour/day_of_week to route and isochrone endpoints — v2.1
- ✓ URL persistence for departure time enabling shareable deep links — v2.1
- ✓ Edge-based isochrone SQL functions returning per-street geometries with band assignment — v2.2
- ✓ Edge isochrone API with view parameter and Fill/Streets frontend toggle — v2.2
- ✓ Zoom-responsive colored street line rendering for edge-based isochrones — v2.2
- ✓ Multi-stop waypoint routing backend with per-leg directions — v2.2
- ✓ Waypoint frontend: Add Stop, WaypointSearch, numbered map markers, leg-grouped directions — v2.2
- ✓ Ferry routes isolated from bridge/tunnel nodes — only connect at terminals — v2.3
- ✓ Ferry edges remain bikeable/walkable, not driveable — v2.3
- ✓ Codebase KISS review: dead code removed, logic simplified — v3.0
- ✓ Repo cleanup: junk files removed, .gitignore comprehensive, CI updated — v3.0
- ✓ Professional README.md with badges, features, Quick Start, API docs — v3.0
- ✓ MIT LICENSE and CONTRIBUTING.md — v3.0
- ✓ Live traffic auto-refresh with atomic updates, incremental writes, retry logic — v4.0
- ✓ Configurable TRAFFIC_ENABLED/TRAFFIC_REFRESH_INTERVAL env vars, background startup — v4.0
- ✓ Traffic status/refresh endpoints, health integration — v4.0
- ✓ Toggleable traffic layer with bbox-filtered GeoJSON, viewport-bounded loading — v4.0
- ✓ Color-coded traffic overlay with legend and freshness indicator — v4.0
- ✓ Traffic volume audit: deprecated dynamic volume lookup, simplified SQL fallback chain — v4.0
- ✓ Hero screenshot and feature screenshots in README — v4.1
- ✓ Social preview image for GitHub sharing — v4.1
- ✓ CI badge, compelling repo description, CHANGELOG.md — v4.1
- ✓ 14 GitHub topic tags for discoverability — v4.1
- ✓ Dependabot alert triage: gunicorn removed, ESLint modernized, lockfile cleaned — v4.1

### Active

- [ ] Remove duplicate Dockerfiles and stale internal artifacts
- [ ] Fix stale docker-compose.yml comment referencing non-existent doc
- [ ] Top-level Makefile for project-wide commands (build, test, lint, import, db)
- [ ] Brief docs/ARCHITECTURE.md covering data flow, import pipeline, routing algorithm

### Out of Scope

- Authentication or user accounts — POC stays anonymous
- Dark mode — shipped one strong identity first
- Custom map tiles/styles — MapLibre base map stays as-is
- Animation libraries (framer-motion, react-spring) — CSS transitions sufficient
- More than 3 waypoints — each adds a routing call, cap keeps performance reasonable
- Waypoint optimization (TSP) — traveling salesman adds significant complexity

## Context

- **Current Milestone:** v4.2 Developer Experience
- **Shipped:** v4.1 GitHub Polish (2026-02-15), v4.0 Live Traffic (2026-02-15), v3.0 Public Release (2026-02-14), v2.3 Ferry Route Fix (2026-02-14), v2.2 Edge Isochrones & Waypoints (2026-02-14), v2.1 Departure Time (2026-02-14), v2.0 Isochrone Reachability (2026-02-14), v1.1 UI Polish (2026-02-13), v1.0 UI Redesign (2026-02-13)
- **Stack:** React 18 + TypeScript + MUI 7 + MapLibre GL 5 + Vite
- **State management:** React Context API (RoutingContext, IsochroneContext, MapInstanceContext, MessageContext)
- **Theme:** MTA Blue #0039A6, Inter Variable font, 6px spacing, MODE_COLORS (drive=blue, bike=green, walk=orange)
- **Layout:** AdaptiveLayout (desktop 400px sidebar, tablet 340px, mobile bottom sheet), collapsible to 56px with icon rail
- **Z-index hierarchy:** map controls 1050 < bottom sheet 1200 < dropdown 1210
- **Testing:** 31 frontend tests (13 component + 18 a11y) via Vitest + vitest-axe; 11 backend waypoint unit tests
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
| Three-state DepartureTimePicker UI | "Now" default → expanded selects → "Leave at Day Time" summary, matching compact control pattern | ✓ Good — minimal space usage, intuitive flow |
| MUI Select variant="standard" for picker | No border/outline for visual compactness matching TrafficToggle inline style | ✓ Good — blends with existing controls |
| Verification-only Phase 8 | All API/URL plumbing already existed from v2.0, just needed confirmation | ✓ Good — saved dev time, documented pre-existing wiring |
| Exclusive band assignment for edge isochrones | Each edge in exactly one band prevents duplicate rendering | ✓ Good — clean visualization, no client dedup needed |
| Separate useWaypointRouteFetch hook | Preserves existing useRouteFetch unchanged, parallel hook pattern | ✓ Good — zero regressions in existing routing |
| Waypoint delegates to existing mode-specific methods | No new SQL needed, per-leg assembly reuses proven routing | ✓ Good — minimal backend changes, all modes work |
| View parameter dispatch for isochrone API | Single endpoint with polygon/edges switch via view= param | ✓ Good — backward compatible, clean separation |
| Post-topology node isolation for ferry edges | Create new vertices at same geometry, update only ferry edge references | ✓ Good — 129 nodes isolated, zero network fragmentation |
| TRIM(rw_type) for LION comparisons | LION stores rw_type as varchar(2) with leading spaces | ✓ Good — essential for correct bridge/tunnel detection |
| git rm --cached for internal artifacts | Keep .planning/CLAUDE.md on disk, untrack from git | ✓ Good — local dev files preserved, clean public repo |
| *.png in .gitignore with favicon exception | Block all debug screenshots, !client/public/favicon.png preserves needed asset | ✓ Good — prevents future screenshot pollution |
| Atomic staging table for traffic refresh | Temp table + IS DISTINCT FROM prevents inconsistency window during refresh | ✓ Good — routes never degrade mid-refresh |
| TrafficLayerContext outside RoutingContext | Traffic layer independence from routing state (VIZ-02) | ✓ Good — works in all modes, no route needed |
| MIN_ZOOM=12 + 400ms debounce for traffic layer | Prevent city-wide GeoJSON overload on map pan/zoom | ✓ Good — responsive even with 10K+ edges |
| Deprecate dynamic volume lookup from SQL | Only 2.08% unique coverage, 96% overwritten by speed service, 6 CASE blocks with hardcoded thresholds | ✓ Good — -168 lines complexity, cleaner fallback chain |
| Keep _hour/_day_of_week params unused | Backward compatibility for existing API consumers | ✓ Good — no breaking changes |

---
*Last updated: 2026-02-15 after v4.2 milestone started*
