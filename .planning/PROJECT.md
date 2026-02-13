# NYC Open Routing — UI Redesign

## What This Is

A comprehensive UI redesign of the NYC Open Routing app — a proof-of-concept multi-modal routing tool for NYC using pgRouting and the LION street network. The app already works (driving, walking, biking routes with traffic awareness), but the interface feels dated and bloated. This milestone gives it a polished, NYC transit-inspired visual identity with proper tablet/mobile responsiveness.

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

### Active

- [ ] Compact, modern sidebar that takes less vertical space
- [ ] NYC transit-inspired visual identity (MTA colors, bold typography, subway-map aesthetic)
- [ ] Redesigned route result cards (distance, time, turn-by-turn)
- [ ] Polished map controls (zoom, mode buttons, overlays)
- [ ] Global color theme and typography overhaul
- [ ] Tablet-optimized layout
- [ ] Mobile bottom sheet improvements for small screens
- [ ] Easy-win UX enhancements (animations, transitions, visual feedback)

### Out of Scope

- Backend/API changes — this is a frontend-only redesign
- New routing features (new modes, new algorithms) — UI only
- Authentication or user accounts — POC stays anonymous
- Dark mode — pick one strong theme and ship it
- Custom map tiles/styles — MapLibre base map stays as-is

## Context

- Current stack: React 18 + TypeScript + MUI 7 + MapLibre GL 5 + Vite
- State management: React Context API (RoutingContext, MapInstanceContext, MessageContext)
- Existing responsive system: AdaptiveLayout component + useResponsive hook + mobile BottomSheet
- MUI is already the component library — redesign builds on top of MUI theming, not replacing it
- Current sidebar has: two search inputs, travel mode selector, traffic toggle, route results list
- Codebase map available at `.planning/codebase/` for detailed architecture reference

## Constraints

- **Tech stack**: Must stay within React + MUI + MapLibre GL — no new UI frameworks
- **Functionality**: All existing features must continue to work after redesign
- **Browser support**: Modern browsers only (ESNext target, MapLibre v5 requirement)
- **Performance**: No heavy animation libraries — CSS transitions and MUI built-ins only

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| MTA transit-inspired visual identity | NYC routing app should feel like NYC — bold, utilitarian, recognizable | — Pending |
| Build on MUI theming (not replace) | MUI 7 already in use, custom theme is lower risk than new library | — Pending |
| Frontend-only scope | Backend works fine, risk is in the UI layer | — Pending |
| No dark mode for v1 | Ship one strong identity first, dark mode adds complexity | — Pending |

---
*Last updated: 2026-02-12 after initialization*
