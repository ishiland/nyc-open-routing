# Milestones

## v1.0 UI Redesign (Shipped: 2026-02-13)

**Phases completed:** 5 phases, 8 plans | 33 files changed, +1045/-391 lines | 6,546 LOC TypeScript
**Git range:** ed1696b..9e78c3b (15 feat commits)

**Key accomplishments:**
- MTA transit-inspired design system: #0039A6 blue primary, Inter font, 6px spacing base, mode-specific colors
- Responsive layout: collapsible desktop sidebar (400px→56px), tablet 340px, mobile bottom sheet with gesture isolation
- Compact sidebar: ToggleButtonGroup mode selector, inline toggles, size="small" search inputs, transit-themed MapControls
- Route display polish: MODE_COLORS[mode] dynamic accents on cards/icons/chips, active step highlighting, maxZoom cap
- WCAG 2.1 AA compliance: contrast fixes, ARIA labels on all controls, keyboard navigation, focus management, 18 a11y tests

---


## v1.1 UI Polish (Shipped: 2026-02-13)

**Phases completed:** 1 phase, 3 plans | 6 files changed, +88/-21 lines | 6,613 LOC TypeScript
**Git range:** e14bed9..597bcec (6 feat/fix commits)

**Key accomplishments:**
- Collapse button repositioned below TitleBar, eliminating info button click interception
- Deep link mode race condition fixed with isInitialized ref guard + queueMicrotask
- Mobile autocomplete z-index raised above bottom sheet (1210 > 1200) with disablePortal
- Collapsed sidebar shows colored travel mode icon rail with tooltips
- Empty state "Get started" hint with Directions icon guides new users
- Map controls render disabled placeholders immediately, eliminating pop-in flash

---


## v2.0 Isochrone Reachability (Shipped: 2026-02-14)

**Key accomplishments:**
- Isochrone SQL functions (pgr_drivingDistance + ST_ConcaveHull) for drive/bike/walk with bbox pre-filter optimization
- Isochrone API endpoint (GET /api/isochrone) with traffic-aware drive mode, caching, and fallback
- Frontend Route/Reachability toggle with concentric time-band polygon layers (5/10/15/20 min)
- IsochroneContext for app mode state, useIsochroneFetch hook, isochrone summary in sidebar
- Turn restriction fix: rewrote 04_restrictions.sql to cover all 4 edge-node combinations (8,842 → 35,454 restrictions)
- Map layer z-ordering: centralized enforceLayerOrder, null paint filtering for addLayer, dash pattern persistence fix

---

## v2.1 Departure Time (Shipped: 2026-02-14)

**Phases completed:** 2 phases, 2 plans, 4 tasks | 2 files changed, +220/-1 lines
**Git range:** dd4da49..ccb4da0

**Key accomplishments:**
- Compact DepartureTimePicker with three-state UI: "Depart: Now" default, expanded day/hour selects, "Leave at [Day] [Time]" summary
- Wired into sidebar between TrafficToggle and FerryToggle, auto-hides when not in drive+traffic mode
- Verified API integration passes hour/day_of_week params to route and isochrone endpoints
- Verified URL persistence enables shareable deep links with departure time restoration

---


## v2.2 Edge Isochrones & Waypoints (Shipped: 2026-02-14)

**Phases completed:** 4 phases, 8 plans | 24 files changed, +2881/-134 lines
**Git range:** f8d28b2..b1baabd

**Key accomplishments:**
- Edge-based isochrone SQL functions returning per-street LineString geometries with band assignment for drive, bike, and walk modes
- Edge isochrone API endpoint with view=edges parameter and Fill/Streets frontend toggle with zoom-responsive line widths
- Multi-stop waypoint routing backend: Pydantic models, service layer, GET /api/route/waypoints endpoint, 11 unit tests
- Waypoint frontend: Add Stop button, WaypointSearch autocomplete, blue numbered map markers, leg-grouped turn-by-turn directions
- End-to-end browser verification with stale waypointRoute bug fix

---

## v2.3 Ferry Route Fix (Shipped: 2026-02-14)

**Phases completed:** 1 phase, 1 plan, 2 tasks | 1 file changed, +175/-30 lines
**Git range:** 698aca0..f06e755

**Key accomplishments:**
- Isolated 129 ferry internal nodes from bridge/tunnel topology, preventing invalid mid-crossing route transitions
- Preserved 22 terminal nodes for street network connectivity at ferry boarding points
- Updated 260 ferry edge source/target references to new isolated vertices
- Verified SI Ferry crossing, all bridge/tunnel routes, and network integrity (99,404-node dominant component)

---


## v3.0 Public Release (Shipped: 2026-02-14)

**Phases completed:** 3 phases, 4 plans | 141 files changed, +529/-21,141 lines
**Git range:** v2.3..HEAD

**Key accomplishments:**
- Backend KISS review: removed dead code, unused imports, orphaned functions, debug files across API + data-importer + scripts
- Frontend KISS review: 408 lines dead code removed, deleted orphaned utils/search.tsx, fixed null paint bug in useGeoJsonLayer
- Repo cleanup: 117 files untracked/deleted, comprehensive .gitignore (62 lines), CI workflow updated (master branch, current action versions, Node 23)
- Professional README.md with shields.io badges, 8 feature descriptions, 5-step Quick Start, API endpoint documentation, architecture overview
- MIT LICENSE (2026) and CONTRIBUTING.md with dev setup, code style guidelines (Python + TypeScript), PR process

---


## v4.0 Live Traffic (Shipped: 2026-02-15)

**Phases completed:** 3 phases, 6 plans | 27 files changed, +3156/-239 lines
**Git range:** 1977aca..9743507

**Key accomplishments:**
- TrafficRefreshService with atomic staging table updates, incremental writes, and configurable auto-refresh (TRANSCOM speed data via Socrata API)
- FastAPI lifespan background task with startup retry, health integration, status/refresh endpoints, and env-configurable TRAFFIC_ENABLED/TRAFFIC_REFRESH_INTERVAL
- Toggleable map traffic layer with bbox-filtered GeoJSON endpoint, viewport-bounded loading, debounced moveend fetch, and MIN_ZOOM=12 guard
- Color-coded street overlay (green/yellow/orange/red) with legend, freshness indicator, and independence from routing state
- Coverage audit: 10,923 edges (6.76%) with live speed data vs 3,488 (2.16%) with static volume data — deprecated dynamic volume lookup (-168 lines)
- Simplified SQL routing functions to `COALESCE(traffic_factor, 1.0)` fallback chain across all 3 traffic-aware functions

---


## v4.1 GitHub Polish (Shipped: 2026-02-15)

**Phases completed:** 3 phases, 6 plans | 24 files changed, +1494/-4110 lines

**Key accomplishments:**
- 8 polished README screenshots (hero, routing, isochrone, waypoints, traffic, autocomplete, mobile) + social preview image
- CI status badge, CHANGELOG.md (9 versions), 14 GitHub topic tags, compelling repo description
- Dependabot triage: removed unused gunicorn, replaced CRA ESLint config with modern @typescript-eslint + react-hooks, regenerated lockfile (-3303 lines phantom CRA deps)
- 0 critical/high npm audit vulnerabilities, 8/8 requirements complete

---

