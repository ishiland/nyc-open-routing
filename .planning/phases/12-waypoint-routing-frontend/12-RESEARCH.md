# Phase 12: Waypoint Routing Frontend - Research

**Researched:** 2026-02-14
**Domain:** React/TypeScript UI for multi-stop waypoint routing, MapLibre GL marker management, Context API state extension
**Confidence:** HIGH

## Summary

Phase 12 adds frontend support for multi-stop waypoint routing. The backend (Phase 11, verified and complete) exposes `GET /api/route/waypoints?waypoints=lon,lat|lon,lat|lon,lat&mode=drive` returning a `WaypointRouteResponse` with `legs[]` (each containing `features[]` and `summary`) and an overall `summary`. The frontend must: (1) let users add/remove up to 3 intermediate waypoints via the sidebar, (2) display numbered markers on the map, (3) fetch from the waypoint endpoint, (4) show turn-by-turn directions grouped by leg, and (5) keep existing two-point routing unchanged.

The existing codebase uses React Context (`RoutingContext`) for all routing state, a `useRouteFetch` hook for API calls, `useGeoJsonLayer` for MapLibre GL layer management, and a clear component hierarchy: `Sidebar` -> `Search` (Start/End) + `ButtonControls` + `RouteList`. The `Route` interface holds `features[]` and the `RouteList` renders them flat. The map uses circle markers with text labels for start (A) and end (B) points.

The implementation requires: extending `RoutingContext` with a `waypoints` array, creating a new `useWaypointRouteFetch` hook (or extending `useRouteFetch`), adding a `WaypointInputs` component for the sidebar, adding waypoint markers to the map, and restructuring `RouteList` to support leg-grouped display when waypoint data is present.

**Primary recommendation:** Add waypoint state to `RoutingContext` as `waypoints: IMapFeature[]`, create a parallel fetch hook for the waypoint endpoint, add a simple "Add Stop" UI between search inputs, render numbered intermediate markers on the map, and modify `RouteList` to group by leg. Conditionally use waypoint flow when `waypoints.length > 0`, preserving the existing two-point flow as the default.

## Standard Stack

### Core (Already In Project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.2 | UI framework | Already powers all components |
| TypeScript | 5.3 | Type safety | Already configured with strict mode |
| MUI | 7.0.1 | Component library | Already used for all UI elements |
| MapLibre GL | 5.3 | Map rendering | Already handles all map layers and markers |

### Supporting (Already In Project)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @mui/icons-material | 7.0.1 | Icons | Waypoint marker icons, add/remove buttons |
| @turf/helpers | 7.2 | GeoJSON utilities | Feature construction if needed |
| vitest | 1.2 | Testing | Unit tests for new components/hooks |
| @testing-library/react | 14.1 | Component testing | Testing waypoint UI interactions |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Context API state for waypoints | Separate WaypointContext | Would add another context provider to App.tsx; keeping it in RoutingContext is simpler since waypoints are part of routing state |
| MapLibre circle+symbol layers for waypoint markers | MapLibre Marker DOM elements | DOM markers offer easier numbering/styling but don't integrate with existing `useGeoJsonLayer` pattern; circle+symbol layers are consistent with start/end markers |
| Extending `useRouteFetch` | New `useWaypointRouteFetch` hook | Extending existing hook adds conditional logic complexity; a separate hook is cleaner and preserves the existing hook unchanged |

**Installation:** No new packages needed.

## Architecture Patterns

### Recommended State Structure

```typescript
// In RoutingContext - new state additions
waypoints: IMapFeature[]          // Intermediate waypoints (0-3 items)
setWaypoints: (waypoints: IMapFeature[]) => void
addWaypoint: (waypoint: IMapFeature) => void
removeWaypoint: (index: number) => void
clearWaypoints: () => void

// New response type for waypoint routes
waypointRoute: WaypointRouteResponse | null
setWaypointRoute: (route: WaypointRouteResponse | null) => void
```

### Pattern 1: Conditional Routing Flow

**What:** When `waypoints.length > 0`, the app uses the waypoint API endpoint; otherwise, it uses the existing two-point routing.
**When to use:** In `ButtonControls` and `RouteStateManager` where route fetching is triggered.
**Why:** Preserves the existing two-point UX completely (success criterion #5). The waypoint flow is an additive layer.

```typescript
// In ButtonControls or a new routing orchestrator
const hasWaypoints = waypoints.length > 0

const handleGetDirections = () => {
  if (hasWaypoints) {
    fetchWaypointRoute()  // calls /api/route/waypoints
  } else {
    fetchRoute()          // calls /api/route (existing)
  }
}
```

### Pattern 2: Waypoint Markers via useGeoJsonLayer

**What:** Render intermediate waypoint markers using the same `useGeoJsonLayer` hook pattern as start/end markers.
**When to use:** In `MapLibreGLMap.tsx` for each waypoint.
**Why:** Consistent with existing marker rendering; integrates with layer ordering and cleanup.

```typescript
// Waypoint marker color (distinct from start green and end red)
const waypointPointColor = "#3b82f6"  // Blue (distinguishable from start/end)

// Render waypoint markers as a single GeoJSON source with numbered labels
// Each waypoint gets a circle layer and a symbol layer with its number (1, 2, 3)
useGeoJsonLayer(
  map,
  "waypointPointSource",
  "waypointPointLayer",
  waypointFeatures,  // IMapFeature[] from context
  {
    type: "circle",
    paint: {
      ...addressPointPaint,
      "circle-color": waypointPointColor,
    },
  },
)

// Numbered labels using data-driven text-field
useGeoJsonLayer(
  map,
  "waypointLabelSource",
  "waypointLabelLayer",
  waypointFeatures,
  {
    type: "symbol",
    layout: {
      "text-field": ["get", "waypointNumber"],  // Property on each feature
      "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
      "text-size": 14,
      "text-anchor": "center",
    },
    paint: {
      "text-color": "#ffffff",
      "text-halo-color": waypointPointColor,
      "text-halo-width": 1,
    },
  },
)
```

### Pattern 3: Leg-Grouped RouteList

**What:** When displaying waypoint routes, group turn-by-turn directions under leg headers (e.g., "Leg 1: Origin to Waypoint 1").
**When to use:** In `RouteList` when `waypointRoute` is present.
**Why:** Success criterion #4 requires directions grouped by leg.

```typescript
// In RouteList - conditional rendering
if (waypointRoute) {
  // Render legs with headers
  return waypointRoute.legs.map((leg, i) => (
    <React.Fragment key={leg.leg}>
      <LegHeader
        legIndex={i}
        summary={leg.summary}
        fromLabel={getLegFromLabel(i)}
        toLabel={getLegToLabel(i)}
      />
      {leg.features.map(feature => (
        <RouteStep key={feature.properties.seq} feature={feature} />
      ))}
    </React.Fragment>
  ))
} else if (route) {
  // Existing flat rendering (unchanged)
  return route.features.map(feature => ...)
}
```

### Pattern 4: Search Component Reuse for Waypoints

**What:** Reuse the existing `Search` component (or a simplified variant) for waypoint address inputs.
**When to use:** In the sidebar waypoint input section.
**Why:** The `Search` component already handles address autocomplete, geolocation, debounced fetching, and suggestion selection. Reusing it avoids duplicating complex logic.

```typescript
// The existing Search component accepts type: "Start" | "End"
// For waypoints, we need to extend or create a variant that:
// 1. Accepts a waypoint index
// 2. Calls addWaypoint/removeWaypoint instead of setAddress
// 3. Stores input text per waypoint

// Option A: Extend SearchProps to support waypoint type
interface SearchProps {
  type: "Start" | "End" | "Waypoint"
  waypointIndex?: number  // Only used when type === "Waypoint"
}

// Option B: Create a simpler WaypointSearch that wraps Search logic
// This avoids modifying the existing Search component
```

### Recommended Component Structure

```
client/src/
  components/
    controls/
      Search.tsx              # Existing - no changes needed
      RouteList.tsx           # Modified - add leg-grouped rendering
      RouteSummaryCard.tsx    # Modified - handle waypoint summary
      ButtonControls.tsx      # Modified - conditional waypoint fetch
      WaypointInputs.tsx      # NEW - waypoint add/remove UI
      WaypointSearch.tsx      # NEW - address search for waypoints (reuses Search patterns)
      LegHeader.tsx           # NEW - leg separator in RouteList
  hooks/
    useRouteFetch.ts          # Existing - no changes needed
    useWaypointRouteFetch.ts  # NEW - fetch from /api/route/waypoints
  contexts/
    RoutingContext.tsx         # Modified - add waypoint state
  types/
    interfaces.ts             # Modified - add WaypointRouteResponse types
  utils/
    mapHelpers.ts             # Modified - add waypoint layers to CUSTOM_LAYER_ORDER
    style.ts                  # Modified - add waypoint marker color
```

### Anti-Patterns to Avoid

- **Modifying the existing `useRouteFetch` hook:** Adding conditional waypoint logic to the existing hook risks breaking two-point routing. Create a new `useWaypointRouteFetch` hook instead.
- **Changing the `Route` interface:** The `Route` interface (`{ features?: RouteFeature[] }`) is used throughout the codebase. Don't modify it for waypoint data. Add a separate `WaypointRouteResponse` type.
- **Modifying existing `Search` component internals:** The `Search` component is well-tested and memoized. Rather than adding waypoint-specific branching inside it, create a new `WaypointSearch` component that reuses the same hooks and patterns.
- **Putting all waypoint state in a separate context:** Waypoints are fundamentally part of routing state. Adding a fourth context would fragment related state and require coordinating between contexts for route calculation.
- **Dynamic source/layer IDs per waypoint:** Don't create separate MapLibre sources per waypoint (e.g., `waypoint0Source`, `waypoint1Source`). Use a single GeoJSON source with all waypoint features, and use data-driven styling for numbered labels. This is cleaner and avoids layer cleanup complexity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Address autocomplete for waypoints | Custom search input with fetch logic | Reuse patterns from existing `Search` + `useDebouncedFetch` + `SuggestionDropdown` | 300+ lines of tested autocomplete, keyboard navigation, recent searches logic |
| Map markers for waypoints | Custom DOM marker overlay | `useGeoJsonLayer` hook with circle + symbol layers | Consistent with existing start/end markers, handles cleanup, layer ordering |
| GeoJSON feature construction | Manual feature object building | Existing `IMapFeature` interface and pattern from `Search.transformSearchResult` | Avoids geometry format mistakes |
| Route display formatting | Custom distance/time formatting | Existing `formatDistance`, `formatTotalRouteTime`, `formatTotalRouteDistance` from `utils/formats.ts` | Already handles unit conversion, formatting edge cases |
| Layer z-ordering | Manual `moveLayer` calls | `enforceLayerOrder` from `utils/mapHelpers.ts` | Already handles all custom layer ordering; just add new layer IDs to `CUSTOM_LAYER_ORDER` |

**Key insight:** The frontend waypoint feature is primarily a UI composition problem. All the hard infrastructure (address search, map layers, route formatting, API communication) already exists. The new code composes existing pieces into a waypoint-aware flow.

## Common Pitfalls

### Pitfall 1: Route Layer Data Source Mismatch
**What goes wrong:** The existing route layer (`routeLayer`) expects a flat `RouteFeature[]` from `route.features`. Waypoint routes return `WaypointRouteResponse.legs[].features[]` (nested). If you try to pass waypoint response directly to the route layer, it will either error or show nothing.
**Why it happens:** Different response shapes between `/api/route` and `/api/route/waypoints`.
**How to avoid:** Flatten waypoint legs into a single `RouteFeature[]` array for map display: `const allFeatures = waypointRoute.legs.flatMap(leg => leg.features)`. The route halo and route layers can then use this flat array. Keep the structured `WaypointRouteResponse` for the `RouteList` component where leg grouping matters.
**Warning signs:** Route line disappears or only partial route shows on the map.

### Pitfall 2: Waypoint Index Drift on Remove
**What goes wrong:** User adds 3 waypoints, removes the middle one (index 1). If waypoint marker numbers are tied to array indices, the remaining waypoints show as "1" and "3" instead of "1" and "2".
**Why it happens:** Array splice changes indices of subsequent items.
**How to avoid:** Always re-derive waypoint numbers from the current array position, not from stored IDs. When the `waypoints` array changes, regenerate marker features with sequential numbers from the current array.
**Warning signs:** Marker numbers have gaps or don't match sidebar order.

### Pitfall 3: Stale Route After Waypoint Add/Remove
**What goes wrong:** User adds a waypoint but the displayed route still shows the old two-point route (or the previous waypoint route) until they manually click "Get Directions" again.
**Why it happens:** Route is not automatically recalculated when waypoints change.
**How to avoid:** Decide on behavior: either (a) clear the route display immediately when waypoints change and require the user to click "Get Directions", or (b) auto-recalculate. Option (a) is simpler and consistent with how the app currently works (route is only calculated on button click or mode change). Clear `waypointRoute` and `route` when waypoints are added/removed.
**Warning signs:** Map shows a route that doesn't match the current waypoint configuration.

### Pitfall 4: Swap Button Behavior with Waypoints
**What goes wrong:** The existing "Swap start and end addresses" button doesn't account for waypoints. Swapping start/end with waypoints in between creates a confusing route order.
**Why it happens:** `swapAddresses` only swaps `startAddress` and `endAddress`.
**How to avoid:** Either (a) disable the swap button when waypoints are present, or (b) reverse the entire waypoint array along with start/end swap. Option (a) is simpler for POC and avoids edge cases.
**Warning signs:** Swapped route doesn't include waypoints or shows them in wrong order.

### Pitfall 5: Clear Button Must Reset Waypoints
**What goes wrong:** User clicks "Clear" but waypoints remain in state, causing the next "Get Directions" to unexpectedly use the waypoint endpoint.
**Why it happens:** Existing `clearAddresses()` in `RoutingContext` only clears start/end.
**How to avoid:** Extend `clearAddresses` (or create `clearAll`) to also clear waypoints and waypointRoute. The `reset` function in `ButtonControls` must call this.
**Warning signs:** After clearing, route calculation uses waypoint endpoint with stale waypoint data.

### Pitfall 6: Mobile Layout Considerations
**What goes wrong:** Waypoint inputs don't fit in the mobile bottom sheet, creating overflow or unusable UI.
**Why it happens:** Bottom sheet has limited vertical space, especially at the 40% snap point.
**How to avoid:** For POC, consider making waypoint inputs only available in the expanded bottom sheet state (60% or 90% snap), or keep waypoint support desktop/tablet only. The "Add Stop" button can be visible but the inputs should collapse gracefully.
**Warning signs:** Mobile bottom sheet content overflows or becomes unscrollable.

### Pitfall 7: useGeoJsonLayer Cleanup on Waypoint Count Change
**What goes wrong:** When waypoints are removed and the array becomes empty, the waypoint marker layer remains on the map.
**Why it happens:** `useGeoJsonLayer` handles null data correctly (removes layer), but the waypoint feature array might be `[]` instead of `null`.
**How to avoid:** In the `useGeoJsonLayer` hook, empty arrays are already normalized to `null` (line 33 of `useGeoJsonLayer.ts`: `if (validFeatures.length === 0) return null`). This means passing `waypoints.length === 0 ? null : waypointFeatures` works correctly. Just ensure the data prop is `null` when there are no waypoints.
**Warning signs:** Ghost markers remain on map after all waypoints are removed.

## Code Examples

### WaypointRouteResponse TypeScript Interface

```typescript
// In types/interfaces.ts - matches backend WaypointRouteResponse exactly
export interface LegSummary {
  distance: number    // feet
  travel_time: number // minutes
}

export interface LegResponse {
  leg: number
  summary: LegSummary
  features: RouteFeature[]
}

export interface WaypointRouteSummary {
  total_distance: number
  total_travel_time: number
  num_legs: number
}

export interface WaypointRouteResponse {
  legs: LegResponse[]
  summary: WaypointRouteSummary
}
```

### Waypoint Fetch Hook

```typescript
// In hooks/useWaypointRouteFetch.ts
// Pattern mirrors useRouteFetch but targets /api/route/waypoints

const buildWaypointUrl = (
  startAddress: IMapFeature,
  endAddress: IMapFeature,
  waypoints: IMapFeature[],
  mode: TravelMode,
  useTraffic: boolean,
  avoidFerries: boolean,
  trafficHour: number | null,
  trafficDayOfWeek: number | null,
): string => {
  const startGeom = startAddress.geometry as Point
  const endGeom = endAddress.geometry as Point
  const startCoords = startGeom.coordinates.join(",")
  const endCoords = endGeom.coordinates.join(",")

  // Build pipe-delimited waypoints: start|wp1|wp2|...|end
  const allPoints = [
    startCoords,
    ...waypoints.map(wp => {
      const geom = wp.geometry as Point
      return geom.coordinates.join(",")
    }),
    endCoords,
  ]
  const waypointsParam = allPoints.join("|")

  let url = `/api/route/waypoints?waypoints=${waypointsParam}&mode=${mode}`
  if (mode === "drive") {
    url += `&use_traffic=${useTraffic}`
    if (useTraffic && trafficHour !== null && trafficDayOfWeek !== null) {
      url += `&hour=${trafficHour}&day_of_week=${trafficDayOfWeek}`
    }
  }
  if (mode === "bike" || mode === "walk") {
    url += `&avoid_ferries=${avoidFerries}`
  }
  return url
}
```

### Waypoint Feature Construction for Map Markers

```typescript
// Convert waypoint IMapFeature[] to features with waypointNumber property
const buildWaypointMarkerFeatures = (waypoints: IMapFeature[]): IMapFeature[] => {
  return waypoints.map((wp, index) => ({
    ...wp,
    properties: {
      ...wp.properties,
      waypointNumber: String(index + 1),  // "1", "2", "3" for data-driven labels
    },
  }))
}
```

### Flattening Legs for Map Route Display

```typescript
// Flatten WaypointRouteResponse legs into RouteFeature[] for map layers
const flattenWaypointRoute = (
  waypointRoute: WaypointRouteResponse
): RouteFeature[] => {
  return waypointRoute.legs.flatMap(leg => leg.features)
}
```

### Layer Order Update

```typescript
// In utils/mapHelpers.ts - insert waypoint layers between route and start point
export const CUSTOM_LAYER_ORDER = [
  "isochroneFillLayer",
  "isochroneOutlineLayer",
  "isochroneEdgesLayer",
  "routeHaloLayer",
  "routeLayer",
  "waypointPointLayer",      // NEW - between route and start/end markers
  "waypointLabelLayer",      // NEW
  "startPointLayer",
  "endPointLayer",
  "startPointLabelLayer",
  "endPointLabelLayer",
]
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MapLibre GL Marker DOM elements for map pins | GeoJSON circle + symbol layers | Current project convention | All markers use `useGeoJsonLayer`; maintain consistency |
| Separate contexts per feature domain | Single RoutingContext for all routing state | Current project convention | Waypoints belong in RoutingContext |
| Inline fetch logic in components | Custom hooks for data fetching | Current project convention | Create `useWaypointRouteFetch` following `useRouteFetch` pattern |

**Deprecated/outdated:**
- None relevant. The project uses current versions of all libraries.

## Backend API Reference (Phase 11 Complete)

**Endpoint:** `GET /api/route/waypoints`

**Parameters:**
- `waypoints` (required): Pipe-delimited lon,lat pairs. Min 2, max 3. Example: `-73.98,40.75|-73.99,40.76|-74.00,40.77`
- `mode` (required): `drive`, `bike`, or `walk`
- `use_traffic` (optional, default true): Traffic-aware routing (drive only)
- `avoid_ferries` (optional, default false): Avoid ferries (bike/walk only)
- `hour` (optional): 0-23 for time-specific traffic
- `day_of_week` (optional): 1-7 (Mon-Sun) for time-specific traffic

**Response (`WaypointRouteResponse`):**
```json
{
  "legs": [
    {
      "leg": 0,
      "summary": { "distance": 5280.0, "travel_time": 12.5 },
      "features": [
        {
          "type": "Feature",
          "properties": {
            "seq": 1, "street": "BROADWAY", "distance": 2640.0,
            "travel_time": 6.2, "turn_instruction": "Start",
            "turn_type": "continue", "traffic_factor": 1.0
          },
          "geometry": { "type": "LineString", "coordinates": [...] }
        }
      ]
    }
  ],
  "summary": {
    "total_distance": 10560.0,
    "total_travel_time": 25.0,
    "num_legs": 2
  }
}
```

**Error responses:**
- 400: `< 2` or `> 3` waypoints, invalid coordinate format
- 404: No route found for a leg (includes leg number in message)
- 500: Server error

**Note:** Waypoints parameter includes origin and destination (not just intermediates). For a route A -> B -> C, send `waypoints=A|B|C` (3 points = 2 legs). The frontend must prepend start and append end to intermediate waypoints when building the request.

## Open Questions

1. **Waypoint address input approach: full Search reuse vs. simplified input?**
   - What we know: The existing `Search` component is complex (300+ lines) with autocomplete, recent searches, geolocation button. Waypoint inputs need the same address search capability.
   - What's unclear: Whether to reuse `Search` directly (extending its `type` prop) or create a lighter `WaypointSearch` that reuses just the hooks.
   - Recommendation: Create a `WaypointSearch` component that reuses `useDebouncedFetch` and `SuggestionDropdown` but with a simpler layout (no geolocation button, compact styling). This avoids modifying the existing `Search` component while reusing infrastructure.

2. **Auto-recalculate on waypoint change?**
   - What we know: The app currently auto-recalculates routes when mode/traffic/time changes but NOT when addresses change (requires "Get Directions" click). This is handled in `ButtonControls` useEffect.
   - What's unclear: Whether adding/removing a waypoint should auto-recalculate the route.
   - Recommendation: Follow existing convention -- clear the route on waypoint change, require "Get Directions" click. This is simpler, avoids wasted API calls while the user is still building their route, and is consistent with how address changes work.

3. **Maximum waypoints: UI enforcement**
   - What we know: Backend accepts max 3 waypoints (which means max 1 intermediate stop with origin+destination, or max 3 total points). The phase description says "up to 3 intermediate waypoints."
   - What's unclear: The backend validates max 3 total waypoints (origin + intermediates + destination). With origin + destination + 3 intermediates, that would be 5 total waypoints (4 legs), which exceeds the backend limit. The success criteria says "up to 3 intermediate waypoints" but backend only allows max 3 total points.
   - Recommendation: **Clarify with backend.** If backend max is 3 total points, then only 1 intermediate waypoint is possible. The success criteria say "up to 3 intermediate waypoints" which would require backend change to support 5 total points. For now, plan for what the backend supports: 1 intermediate waypoint (3 total points). If backend is updated, the UI can easily scale.
   - **UPDATE after re-reading the additional_context:** The phase description says "up to 3 intermediate waypoints" and the backend accepts "2-3 waypoints." Reading the backend validation more carefully: `len(pairs) > 3` raises 400, meaning max 3 pipe-delimited coordinate pairs total. This means: with origin + 1 waypoint + destination = 3 points. So the backend currently supports **1 intermediate waypoint max**. The frontend should implement for 1 intermediate waypoint now with UI structure that can scale when the backend limit is raised.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis** - Direct reading of all 65+ TypeScript/TSX source files in `client/src/`, all Python API files in `api/`
- **Phase 11 research & verification** - `.planning/phases/11-waypoint-routing-backend/11-RESEARCH.md` and `11-VERIFICATION.md` (confirmed backend complete, all 7 truths verified)
- **Backend schemas** - `api/models/schemas.py` lines 113-136 define WaypointRouteResponse exactly
- **Backend endpoint** - `api/routes/routing.py` lines 46-92 define the waypoint API contract

### Secondary (MEDIUM confidence)
- **MUI 7 documentation** - Component APIs for TextField, IconButton, List, Chip used in patterns (verified against project's MUI 7.0.1)
- **MapLibre GL JS** - Data-driven styling expressions for `text-field: ["get", "propertyName"]` pattern (verified against project's maplibre-gl 5.3)

### Tertiary (LOW confidence)
- None -- all findings verified against actual codebase implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - No new libraries needed; everything is already in the project
- Architecture: HIGH - Patterns derived directly from existing codebase conventions (Context state, hooks, layer management)
- Pitfalls: HIGH - Identified from direct analysis of existing component interactions, data flow, and response shapes

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (stable -- no external dependency changes expected)
