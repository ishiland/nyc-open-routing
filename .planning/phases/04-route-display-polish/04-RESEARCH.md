# Phase 4: Route Display Polish - Research

**Researched:** 2026-02-12
**Domain:** MUI v7 Card/List styling, mode-specific color accents, map interaction from turn-by-turn list
**Confidence:** HIGH

## Summary

Phase 4 polishes two existing components -- `RouteSummaryCard.tsx` and `RouteList.tsx` -- and adds mode-specific color accents plus click-to-zoom behavior. All four requirements (RD-01 through RD-04) modify files that already exist and work. No new components need to be created; this is purely a visual/interaction refinement phase.

The current `RouteSummaryCard` already displays time, distance, mode icon, traffic chip, and arrival time in a Card with `borderLeft: 4, borderColor: "primary.main"`. The main change is making the border color and mode icon color dynamic based on `MODE_COLORS[mode]` instead of hardcoded `primary.main`. The current `RouteList` already renders a turn-by-turn list with `ListItemButton` (clickable) + `TurnIcon` + `ListItemText`, and clicking already calls `setSelectedStreet()` which triggers `zoomToExtent([selectedStreet])` in `MapLibreGLMap.tsx`. So RD-04 (click-to-zoom) is **already implemented** -- the existing wiring in `MapLibreGLMap.tsx` lines 255-259 handles this. The polish work is about making the zoom behavior more precise (zoom level, animation) and ensuring visual feedback (highlight active step).

The project uses MUI v7 (`^7.0.1`), `MODE_COLORS` is already exported from `theme.ts` as `{ drive: "#0039A6", bike: "#087F23", walk: "#E65100" }`, and the `TravelModeSelect` component already demonstrates the pattern of consuming `MODE_COLORS[mode]` dynamically. No new libraries are needed.

**Primary recommendation:** Refactor `RouteSummaryCard` and `RouteList` to consume `MODE_COLORS[mode]` from `theme.ts` for dynamic color accents, improve visual hierarchy with typography weight/size adjustments, and enhance the existing click-to-zoom with visual feedback (active step highlighting) and a more targeted zoom level.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@mui/material` | ^7.0.1 | Card, List, ListItemButton, Typography, Chip, Box | Already in use; all components needed are already imported |
| `@mui/icons-material` | ^7.0.1 | DirectionsCar/Bike/Walk, turn icons, AccessTime, Straighten | Already in use in both components |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `maplibre-gl` | ^5.3.0 | Map fitBounds/flyTo for click-to-zoom | Already in use via useMapZoom hook |
| `turf-extent` | ^1.0.4 | Calculate bounding box for zoom | Already in use via useMapZoom hook |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `sx` prop for dynamic color | `styled()` with theme prop | `sx` is simpler for single-property dynamic values; `styled()` adds unnecessary abstraction for a borderColor change |
| `MODE_COLORS[mode]` direct import | `theme.modeColors[mode]` via `useTheme()` | Both work; direct import is simpler and already the pattern used by `TravelModeSelect.tsx` and `style.ts` |

**Installation:**
No new packages needed. Everything is already installed.

## Architecture Patterns

### Current Component Hierarchy
```
Sidebar.tsx
  ControlsContainer.tsx
    ...controls...
    RouteList.tsx              <-- RD-02, RD-03, RD-04
      RouteSummaryCard.tsx     <-- RD-01, RD-03
      List (turn-by-turn)
        ListItemButton         <-- RD-02, RD-04
          TurnIcon             <-- RD-02
          ListItemText
```

### Data Flow for Click-to-Zoom (Already Implemented)
```
RouteList.tsx: handleStreetSelect(street) -> setSelectedStreet(street)
                                                    |
                                                    v
RoutingContext: selectedStreet state update
                                                    |
                                                    v
MapLibreGLMap.tsx: useEffect watches selectedStreet -> zoomToExtent([selectedStreet])
                                                    |
                                                    v
useMapZoom.ts: fitBounds(extent(featureCollection), { padding })
```

### Pattern 1: Dynamic Mode Color via MODE_COLORS
**What:** Use `MODE_COLORS[mode]` to dynamically set border, icon, and accent colors.
**When to use:** Any component that needs to visually reflect the current travel mode.
**Example:**
```typescript
// Source: Existing pattern in TravelModeSelect.tsx and style.ts
import { MODE_COLORS } from "../../utils/theme"
import { useContext } from "react"
import { RoutingContext } from "../../contexts/RoutingContext"

const { mode } = useContext(RoutingContext)
const modeColor = MODE_COLORS[mode]

// In Card sx prop:
<Card sx={{ borderLeft: 4, borderColor: modeColor }}>

// In icon Box:
<Box sx={{ color: modeColor }}>
  {getModeIcon()}
</Box>
```

### Pattern 2: Active Step Highlighting
**What:** Track which turn-by-turn step is selected and apply visual feedback.
**When to use:** When user clicks a step to zoom the map to it.
**Example:**
```typescript
// Track selected step by seq number from RoutingContext.selectedStreet
const isActive = selectedStreet?.properties.seq === street.properties.seq

<ListItemButton
  onClick={() => handleStreetSelect(street)}
  selected={isActive}
  sx={{
    "&.Mui-selected": {
      bgcolor: `${MODE_COLORS[mode]}14`,  // 8% opacity
      borderLeft: 3,
      borderColor: MODE_COLORS[mode],
    },
  }}
>
```

### Pattern 3: Targeted Zoom for Line Segments
**What:** Use `fitBounds` with a reasonable maxZoom to prevent over-zooming on short segments.
**When to use:** When zooming to a single street segment from turn-by-turn list.
**Example:**
```typescript
// In useMapZoom.ts or MapLibreGLMap.tsx
// The existing zoomToExtent already handles this via turf-extent + fitBounds
// Enhancement: add maxZoom to prevent zooming too close on short segments
map.fitBounds(bounds, { padding, maxZoom: 17 })
```

### Anti-Patterns to Avoid
- **Hardcoding colors in components:** Always reference `MODE_COLORS[mode]` or theme tokens, never inline hex values for mode-specific colors.
- **Creating wrapper components for simple style changes:** This phase is about `sx` prop refinements, not new component abstractions.
- **Duplicating mode-to-color logic:** `MODE_COLORS` in `theme.ts` is the single source of truth. Do not create parallel mappings.
- **Using `primary.main` for mode-specific accents:** The current `RouteSummaryCard` uses `primary.main` (always MTA Blue) for `borderColor` and icon color. This must change to `MODE_COLORS[mode]` to satisfy RD-03.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Bounding box calculation | Manual coordinate math | `turf-extent` + `featureCollection` | Already in use via `useMapZoom`; handles edge cases |
| Map animation | Manual coordinate interpolation | `map.fitBounds()` / `map.flyTo()` | MapLibre's built-in camera animation is GPU-accelerated |
| Selected state management | New state variable in RouteList | `selectedStreet` from RoutingContext | Already exists and is wired to map zoom behavior |
| Color palette management | Per-component color constants | `MODE_COLORS` from theme.ts | Already the established pattern (Phase 1 decision) |

**Key insight:** Almost all the plumbing for this phase already exists. The work is purely about applying mode-aware colors and refining visual polish. Resist the urge to over-engineer.

## Common Pitfalls

### Pitfall 1: Forgetting MODE_COLORS is a Plain Object, Not Theme-Aware
**What goes wrong:** Trying to use `theme.palette.primary.main` or `theme.modeColors[mode]` inside `sx` when the simpler direct import works.
**Why it happens:** MUI convention is to use theme references in `sx`, but `MODE_COLORS` is an exported constant intentionally designed for direct import.
**How to avoid:** Follow the existing pattern in `TravelModeSelect.tsx` -- import `MODE_COLORS` directly and use it in `sx` props.
**Warning signs:** Unnecessary `useTheme()` calls or complex theme callback functions in `sx`.

### Pitfall 2: MUI Selected State Overriding Custom Colors
**What goes wrong:** `ListItemButton` with `selected={true}` applies MUI's default selected styling (primary color with alpha), which may conflict with mode-specific accent colors.
**Why it happens:** MUI's `Mui-selected` class has default styles that may override custom `sx` styles depending on specificity.
**How to avoid:** Use the `"&.Mui-selected"` selector in `sx` to explicitly override the selected background color with the mode-specific color at appropriate opacity.
**Warning signs:** Selected items showing MTA Blue instead of the mode-specific color for bike/walk.

### Pitfall 3: Over-Zooming on Short Street Segments
**What goes wrong:** Clicking a 50-foot street segment in turn-by-turn zooms the map to zoom level 20+, showing only a few meters.
**Why it happens:** `fitBounds` with a tight bounding box and no `maxZoom` will zoom as far as needed to fill the viewport with the segment.
**How to avoid:** Pass `maxZoom: 17` (or similar) to `fitBounds` options. The current `useMapZoom` does NOT cap maxZoom.
**Warning signs:** Map zooming way too close when clicking short segments.

### Pitfall 4: Not Resetting Selected Step on Mode/Route Change
**What goes wrong:** User clicks step 5 in driving mode, switches to biking, and the highlight remains on step 5 of the new route (or worse, the old step 5's data is stale).
**Why it happens:** `selectedStreet` persists across route changes unless explicitly cleared.
**How to avoid:** Verify that route changes already clear `selectedStreet`. Check: does `setRoute(data)` in `useRouteFetch` also reset `setSelectedStreet(null)`? Looking at the code -- it does NOT. The `fetchRoute` callback calls `setRoute(data)` but not `setSelectedStreet(null)`. This needs to be addressed.
**Warning signs:** Stale highlight or map zoom to a location from a previous route.

### Pitfall 5: Hex Color With Alpha for Background Opacity
**What goes wrong:** Using `${MODE_COLORS[mode]}14` (hex + 2-digit alpha) may not work in all browsers for `backgroundColor`.
**Why it happens:** 8-digit hex (`#0039A614`) is CSS Color Level 4 and is well-supported in modern browsers but could fail in older engines.
**How to avoid:** Since this project targets `ESNext` with modern browsers, 8-digit hex is fine. Alternatively, use `alpha()` from MUI's `@mui/system` or manually apply rgba.
**Warning signs:** Background color showing as fully opaque or not showing at all in some browsers.

## Code Examples

Verified patterns from the existing codebase:

### Dynamic Mode Color on Card Border (RD-01 + RD-03)
```typescript
// Current: borderColor: "primary.main" (always MTA Blue)
// Target: borderColor: MODE_COLORS[mode] (dynamic per mode)
import { MODE_COLORS } from "../../utils/theme"

const { mode } = useContext(RoutingContext)

<Card
  sx={{
    width: "100%",
    mb: 2,
    borderLeft: 4,
    borderColor: MODE_COLORS[mode],  // drive=blue, bike=green, walk=orange
    boxShadow: 2,
  }}
  elevation={3}
>
```

### Mode Icon with Dynamic Color (RD-01)
```typescript
// Current: color: "primary.main" (always MTA Blue)
// Target: color: MODE_COLORS[mode]
<Box sx={{ color: MODE_COLORS[mode], display: "flex", alignItems: "center" }}>
  {getModeIcon()}
</Box>
```

### Turn Icon Size Refinement (RD-02)
```typescript
// Current: fontSize="small" (20px) with minWidth: 40
// Target: Adjust for better visual hierarchy
<ListItemIcon sx={{ minWidth: 36 }}>
  <TurnIcon
    turnType={street.properties.turn_type}
    fontSize="small"
    sx={{ color: MODE_COLORS[mode] }}
  />
</ListItemIcon>
```

### Selected Step Visual Feedback (RD-04)
```typescript
// Add selected state to ListItemButton
const isActive = selectedStreet?.properties.seq === street.properties.seq

<ListItemButton
  onClick={() => handleStreetSelect(street)}
  selected={isActive}
  sx={{
    "&.Mui-selected": {
      bgcolor: `${MODE_COLORS[mode]}14`,
      borderLeft: 3,
      borderColor: MODE_COLORS[mode],
      "&:hover": {
        bgcolor: `${MODE_COLORS[mode]}1F`,
      },
    },
  }}
>
```

### Zoom with Max Zoom Cap (RD-04 enhancement)
```typescript
// In useMapZoom.ts, modify fitBounds call
// Current:
map.fitBounds(bounds, { padding })
// Enhanced:
map.fitBounds(bounds, { padding, maxZoom: 17 })
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MUI v7 `secondaryTypographyProps` | `slotProps.secondary` | MUI v7 | Already using `slotProps.primary` in RouteList -- good, no migration needed |
| `primaryTypographyProps` on ListItemText | `slotProps.primary` / `slotProps.secondary` | MUI v7 | The project already uses the v7 pattern |
| Static `primary.main` for all modes | Dynamic `MODE_COLORS[mode]` | Phase 1 decision | MODE_COLORS already exported from theme.ts |

**Deprecated/outdated:**
- `ListItemText` `primaryTypographyProps`/`secondaryTypographyProps`: Replaced by `slotProps` in MUI v7. The codebase already uses the correct v7 pattern.

## Open Questions

1. **Should selectedStreet be cleared on route change?**
   - What we know: `fetchRoute` in `useRouteFetch.ts` calls `setRoute(data)` but NOT `setSelectedStreet(null)`. This means a previously selected step might persist visually after a new route is calculated.
   - What's unclear: Whether this is intentional (preserving selection) or an oversight.
   - Recommendation: Clear `selectedStreet` when a new route is calculated. Add `setSelectedStreet(null)` in `ButtonControls.tsx` or in the route fetch flow. This prevents stale highlights.

2. **What zoom level feels right for single street segments?**
   - What we know: The current `zoomToExtent` uses `fitBounds` with `padding: 50` and no maxZoom cap. Short segments (50-200 ft) will zoom extremely close.
   - What's unclear: Exact ideal maxZoom for NYC streets. Typical routing apps cap at zoom 17-18.
   - Recommendation: Start with `maxZoom: 17` and adjust during visual testing. This shows roughly 1-2 blocks of context around the selected segment.

3. **Should the turn-by-turn list scroll to the active step?**
   - What we know: When a step is clicked, it becomes selected. But if the user scrolls the list and clicks a step far down, the map zooms but the list stays where it is. The reverse case (clicking on the map to highlight a step) is not in scope.
   - What's unclear: Whether auto-scroll is expected behavior for this phase.
   - Recommendation: Defer auto-scroll -- it's not in the requirements (RD-01 through RD-04) and adds complexity. Can be a future enhancement.

## Existing Implementation Analysis

### What Already Works (no changes needed)
- **Click-to-zoom wiring (RD-04 core):** `RouteList` -> `setSelectedStreet` -> `RoutingContext` -> `MapLibreGLMap useEffect` -> `zoomToExtent` is fully functional.
- **Turn-by-turn list structure (RD-02 base):** `List` with `ListItemButton`, `ListItemIcon`, `TurnIcon`, `ListItemText` is already well-structured.
- **Route summary card structure (RD-01 base):** Card with mode icon, distance, duration, arrival time, traffic chip is functional.
- **MODE_COLORS export:** Already exported from `theme.ts` and consumed by `TravelModeSelect.tsx` and `style.ts`.

### What Needs Changing
| File | Current | Target | Requirement |
|------|---------|--------|-------------|
| `RouteSummaryCard.tsx` | `borderColor: "primary.main"` | `borderColor: MODE_COLORS[mode]` | RD-03 |
| `RouteSummaryCard.tsx` | `color: "primary.main"` on icon | `color: MODE_COLORS[mode]` | RD-03 |
| `RouteSummaryCard.tsx` | Chip `color="primary"` | Chip with mode-specific color | RD-03 |
| `RouteList.tsx` | No selected state on ListItemButton | `selected={isActive}` with mode color highlight | RD-04 |
| `RouteList.tsx` | TurnIcon `color="primary"` | TurnIcon with mode-specific color via `sx` | RD-02, RD-03 |
| `RouteList.tsx` | No visual weight differentiation | Refine typography weights/sizes for hierarchy | RD-02 |
| `useMapZoom.ts` | `fitBounds(bounds, { padding })` | `fitBounds(bounds, { padding, maxZoom: 17 })` | RD-04 polish |
| `TurnIcon.tsx` | Only supports MUI `color` prop | May need `sx` pass-through for custom colors | RD-02, RD-03 |

### Files Touched (Estimated)
1. `client/src/components/controls/RouteSummaryCard.tsx` -- RD-01, RD-03
2. `client/src/components/controls/RouteList.tsx` -- RD-02, RD-03, RD-04
3. `client/src/components/shared/TurnIcon.tsx` -- RD-02 (minor: ensure `sx` passthrough works)
4. `client/src/hooks/useMapZoom.ts` -- RD-04 (add maxZoom)
5. Possibly `client/src/hooks/useRouteFetch.ts` or `client/src/components/controls/ButtonControls.tsx` -- clear selectedStreet on route change

## Sources

### Primary (HIGH confidence)
- Codebase inspection: `RouteSummaryCard.tsx`, `RouteList.tsx`, `TurnIcon.tsx`, `theme.ts`, `style.ts`, `MapLibreGLMap.tsx`, `useMapZoom.ts`, `RoutingContext.tsx` -- direct source of truth for current implementation
- `/mui/material-ui/v7_3_2` (Context7) -- confirmed Card sx prop patterns, ListItemButton selected state, v7 slotProps API
- `/maplibre/maplibre-gl-js` (Context7) -- confirmed `flyTo`, `fitBounds` API with maxZoom, padding, animation options

### Secondary (MEDIUM confidence)
- Phase 1 research (`01-RESEARCH.md`) -- established MODE_COLORS pattern, MTA color palette, accessibility contrast ratios
- Phase 3 research (`03-RESEARCH.md`) -- established current component hierarchy and ToggleButtonGroup pattern

### Tertiary (LOW confidence)
- None. All findings verified against codebase and Context7 docs.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- No new libraries, all components already in use
- Architecture: HIGH -- Modifying existing components, well-understood data flow
- Pitfalls: HIGH -- Identified from direct code inspection (selectedStreet clearing, maxZoom cap, color specificity)

**Research date:** 2026-02-12
**Valid until:** 2026-03-12 (stable -- no moving parts, all dependencies locked)
