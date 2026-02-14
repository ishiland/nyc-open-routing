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
