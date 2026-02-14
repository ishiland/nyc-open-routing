# Feature Landscape: Isochrone / Reachability Visualization

**Domain:** Isochrone (travel-time reachability) features for a multi-modal routing application
**Researched:** 2026-02-13
**Focus:** "How far can I go in X minutes?" visualization with concentric time bands
**Confidence:** MEDIUM-HIGH (patterns derived from Mapbox/Valhalla/TravelTime APIs, pgRouting docs, and production isochrone tools)

---

## Table Stakes

Features users expect from any isochrone tool. Missing these and the feature feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Single-origin isochrone polygons | Core feature: show area reachable from a point within N minutes | HIGH | pgr_drivingDistance + PostGIS ST_ConcaveHull pipeline. Heaviest backend work. |
| Concentric time bands (5/10/15/20 min) | Standard across all isochrone tools (Mapbox, Valhalla, TravelTime, Smappen). Users expect multiple bands to compare reach at different thresholds. | MEDIUM | 4 bands is the sweet spot. Mapbox caps at 4 contours; Valhalla allows more but 4 is standard. |
| Multi-modal support (drive/bike/walk) | App already supports 3 modes for routing. Isochrones must support the same modes or users will be confused. | LOW | Reuses existing cost columns (cost_drive, cost_bike, cost_walk) in pgr_drivingDistance SQL. |
| Color-coded polygon fill with transparency | Universal pattern: each time band gets a distinct color at ~30-50% opacity so the base map shows through. | LOW | MapLibre fill layer with data-driven fill-color and fill-opacity. |
| Origin point selection via address search | App already has Geosupport address search. Isochrone origin must use the same search UX rather than requiring a separate input. | LOW | Reuse existing Search component with single-address mode. |
| Click-on-map to set origin | Standard interaction across all isochrone tools (Smappen, iso4app, Geoapify). Users expect to click the map and see isochrones instantly. | MEDIUM | Requires new map click handler, reverse geocoding (or just use raw coordinates), and wiring to isochrone fetch. |
| Loading state during computation | pgr_drivingDistance + polygon generation is slower than point-to-point routing (multiple Dijkstra expansions + geometry ops). Users need feedback. | LOW | Existing LoadingSpinner/isFetching pattern. |
| Clear/reset isochrone | Users must be able to dismiss the isochrone overlay to return to the normal map view. | LOW | Clear button or toggle. Removes the fill/line layers. |
| Responsive rendering order | Largest polygon (20 min) rendered first, smallest (5 min) on top. Otherwise transparency stacking causes color blending artifacts. | LOW | Sort features by time descending before adding to GeoJSON source, or use separate layers with explicit z-ordering. |

---

## Differentiators

Features that set this apart from basic isochrone tools. Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Traffic-aware isochrones (drive mode) | Most isochrone tools use free-flow speeds. NYC Open Routing already has traffic factors -- applying them to isochrone costs shows realistic drive-time reach during rush hour vs off-peak. Unique for a self-hosted tool. | MEDIUM | Use cost_drive * traffic_factor in pgr_drivingDistance SQL, same as getdrivingroute_with_traffic. Time-of-day support included. |
| Edge-based visualization (colored streets) | Instead of (or alongside) polygon blobs, color each reachable street segment by its time band. More accurate than polygons -- shows exactly which streets are reachable and avoids the "concave hull swallowing unreachable areas" problem. | MEDIUM | pgr_drivingDistance returns node+edge pairs. Color edges directly as line layers in MapLibre. No polygon generation needed for this view. |
| Time slider for band adjustment | Let users drag a slider to adjust the max time (e.g., 1-30 min). Isochrone updates live as slider moves. More engaging than fixed presets. | MEDIUM | Frontend slider component + debounced API calls. Requires fast backend response (<1s) or client-side caching of the full node set. |
| Isochrone deep links (URL sharing) | Encode origin, mode, time bands, and traffic setting in URL params so isochrones can be shared. Consistent with existing route deep link pattern. | LOW | Extend existing useRouteStateSync hook. Add params like `iso_origin=lon,lat&iso_mode=drive&iso_time=20`. |
| Summary statistics in sidebar | Show area covered (sq mi), estimated population reached, or street count within each band. Gives the isochrone practical meaning beyond "cool map visual." | MEDIUM | Area: PostGIS ST_Area on polygons. Population: would need census data overlay (defer). Street count: COUNT from pgr_drivingDistance result. |
| Animated isochrone expansion | Smooth animation showing the isochrone growing outward from the origin, band by band. Visually engaging "reveal" effect. | LOW-MEDIUM | Sequential opacity transitions on each band layer with staggered delays. CSS/MapLibre paint property transitions. |
| Dual-mode comparison | Show two isochrones side-by-side (e.g., drive vs walk from same origin) to visually compare modal reach. | MEDIUM | Two concurrent API calls, two sets of fill layers with different color ramps. Need careful z-order and legend. |

---

## Anti-Features

Features to explicitly NOT build. These add complexity without proportional value for a proof-of-concept.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Reverse isochrone ("where can reach ME in X minutes") | Requires running pgr_drivingDistance from every node to the target, or a reverse Dijkstra. Computationally expensive for a PoC. Valhalla supports it but it is a niche use case. | Build standard forward isochrone only. Note reverse as future possibility. |
| Multi-origin isochrone merge/intersection | Overlaying isochrones from multiple origins and computing their union/intersection is an analytics feature (site selection, facility placement). Way beyond PoC scope. | Support single-origin only. |
| Isodistance (distance-based instead of time-based) | Time-based isochrones are more intuitive and useful for most users. Distance-based adds a second mode that needs UI controls without much added value. | Only support time-based. The edge costs are already in time units. |
| POI overlay / demographic analysis | Smappen and TravelTime offer POI counts and census overlays within isochrones. This requires external data integration (NYC open data, census API) that is a separate project. | Show the polygon on the map. Let the user visually assess what is within reach. |
| Real-time isochrone updates as origin is dragged | Continuously recomputing isochrones while dragging a marker requires sub-100ms response times. pgr_drivingDistance on 177K edges will not hit that. | Use click-to-place (not drag) and show loading during computation. |
| Custom time interval entry | Letting users type arbitrary minute values (e.g., 7, 13, 22) instead of using preset bands. Over-engineers the UI for minimal value. | Use fixed presets: 5, 10, 15, 20 min. A slider (differentiator) covers the "custom" need. |
| GeoTIFF / raster export | Valhalla supports GeoTIFF export for grid data. Overkill for a web visualization PoC. | Display polygons on the map only. No export needed. |
| Public transit isochrone | Would require GTFS data integration, schedule-aware routing, and a fundamentally different routing engine. Massive scope increase. | Stick with drive/bike/walk modes that match existing routing capabilities. |
| Polygon smoothing (ST_ChaikinSmoothing) | Adds visual polish but can mask real network topology. Smoothed polygons may cover areas that are genuinely unreachable (rivers, parks, fenced areas). | Use raw concave hull output. The slight roughness is more honest and costs zero extra computation. |

---

## Feature Dependencies

```
Address Search (existing) -----> Origin Selection
                                      |
                                      v
Click-on-Map Origin -----------> Isochrone API Endpoint
                                      |
                                      v
Travel Mode Select (existing) -> pgr_drivingDistance SQL Functions
                                      |
                                      v
                              Polygon Generation (ST_ConcaveHull)
                                      |
                              +-------+--------+
                              |                |
                              v                v
                     Polygon Fill Layer   Edge-Based Layer
                     (concentric bands)  (colored streets)
                              |                |
                              +-------+--------+
                                      |
                                      v
                              Isochrone UI Controls
                              (time presets, clear, toggle)
                                      |
                              +-------+--------+-------+
                              |       |        |       |
                              v       v        v       v
                        Traffic   Time      Deep    Summary
                        Toggle   Slider    Links    Stats
```

**Critical path:** Origin Selection -> API Endpoint -> SQL Functions -> Polygon Generation -> Map Layer

**Independent after core:** Traffic toggle, time slider, deep links, and summary stats can all be built independently once the core isochrone pipeline works.

**Edge-based vs polygon:** These are two visualization approaches for the same underlying data (pgr_drivingDistance result). Edge-based is simpler (no polygon generation), but polygon is more conventional. Build polygon first, add edge-based as an enhancement.

---

## MVP Recommendation

**Prioritize these features for the initial isochrone milestone:**

1. **pgr_drivingDistance SQL functions** (3 modes) -- Backend foundation. Nothing works without this.
2. **Polygon generation via ST_ConcaveHull** -- Converts node set to displayable GeoJSON polygons.
3. **API endpoint** (`GET /api/isochrone`) -- Serves polygon GeoJSON to the frontend.
4. **Concentric band fill layers** (5/10/15/20 min) -- Core visualization on the map.
5. **Origin via address search** -- Reuse existing Search component in single-address mode.
6. **Click-on-map origin** -- Standard isochrone interaction pattern.
7. **Mode selection** -- Reuse existing TravelModeSelect toggle.
8. **Clear/reset button** -- Essential for dismissing the isochrone overlay.
9. **Loading state** -- Required given computation time.

**Defer to post-MVP:**
- **Traffic-aware isochrones:** HIGH value but adds complexity to the SQL and requires testing the traffic factor pipeline with pgr_drivingDistance. Ship basic isochrones first, then layer traffic on.
- **Time slider:** Nice UX but requires fast response times or client-side caching strategy. Fixed presets work fine for V1.
- **Edge-based visualization:** Alternative view mode. Add after polygon approach is solid.
- **Deep links:** Low complexity but not needed for initial feature validation.
- **Summary statistics:** Requires additional SQL aggregation and sidebar UI work.
- **Animated expansion:** Pure polish. Add last.
- **Dual-mode comparison:** Complex UI. Defer to a future milestone.

---

## UX Pattern Recommendations

### Origin Placement

**Pattern:** Two entry points for setting the isochrone origin:
1. **Address search** -- Single input field (not the two-input origin/destination UI). User types an NYC address, selects from autocomplete, isochrone computes.
2. **Map click** -- User clicks anywhere on the map. A marker appears, isochrone computes. Clicking elsewhere moves the origin.

**Rationale:** Every production isochrone tool (Smappen, Geoapify, iso4app, TravelTime) supports both patterns. Address-only forces users to know exact addresses; click-only prevents precise address entry.

### Time Band Controls

**Pattern:** Fixed preset buttons (5 / 10 / 15 / 20 min) displayed as toggle chips or a segmented control, with all selected by default.

**Rationale:** Mapbox caps at 4 contours per request. Valhalla defaults to ~4 intervals. Users understand concentric rings when there are 3-5 bands. More than 5 becomes visually noisy. Allow toggling individual bands on/off.

### Color Scheme

**Recommendation:** Use a sequential ColorBrewer palette (colorblind-safe) with 4 classes. Specific recommendation:

| Band | Time | Color | Hex | Opacity |
|------|------|-------|-----|---------|
| 1 | 5 min | Dark green | #238b45 | 0.40 |
| 2 | 10 min | Medium green | #74c476 | 0.35 |
| 3 | 15 min | Light orange | #fd8d3c | 0.30 |
| 4 | 20 min | Orange-red | #e6550d | 0.25 |

**Rationale:** Green-to-red is intuitive (close = good/green, far = caution/orange-red). Decreasing opacity on outer bands prevents the map from being overwhelmed. ColorBrewer sequential palettes are proven colorblind-safe.

**Alternative for mode-specific coloring:** Use the existing `MODE_COLORS` from the app theme (blue for drive, green for bike, yellow for walk) with lightness-graduated bands within each hue. This maintains visual consistency with the existing route display.

### Polygon Rendering Order

**Pattern:** Render the largest polygon (20 min) first as the bottom layer. Render smallest (5 min) last on top. Each polygon's fill color uses decreasing opacity so all bands remain visible.

**Rationale:** Without this ordering, overlapping transparent polygons create color blending artifacts where the 5-min area appears darker than intended (stacked opacity from all 4 layers). The Mapbox isochrone tutorial and Stadia Maps tutorial both follow this pattern.

### Sidebar Integration

**Pattern:** The isochrone feature should be a distinct "mode" from point-to-point routing, not layered on top of it. When the user activates isochrone mode:
- The two-input search (origin/destination) collapses to a single-input search (origin only)
- The RouteList (turn-by-turn directions) is replaced by isochrone summary info (time bands, area)
- The travel mode selector remains
- Traffic toggle remains (drive mode only, same as routing)

**Rationale:** Isochrone and point-to-point routing are fundamentally different features with different inputs (1 point vs 2 points) and different outputs (polygons vs route line). Trying to show both simultaneously creates visual and cognitive overload.

### Mode Switching

**Pattern:** Add a toggle or tab at the top of the sidebar: "Directions" | "Reachability" (or "How Far?"). This switches the entire sidebar between routing mode and isochrone mode.

**Rationale:** Google Maps uses tabs for different feature modes. This keeps the UI clean and avoids the "too many controls" problem. The map clears the previous mode's visualization when switching.

---

## Competitive Landscape

### What Production Tools Offer

| Feature | Mapbox | Valhalla | TravelTime | Smappen | OpenRouteService | **NYC Open Routing (proposed)** |
|---------|--------|----------|------------|---------|-----------------|-------------------------------|
| Max contours | 4 | Unlimited | Unlimited | 10+ | 10 | 4 (fixed) |
| Max time | 60 min | Configurable | 4 hrs | 12 hrs | 60 min | 20 min |
| Modes | drive, walk, cycle, traffic | auto, bike, pedestrian, multimodal | All + transit | car, bike, walk, transit | car, bike, walk | drive, bike, walk |
| Polygon method | Raster contour | Raster contour | Proprietary | Proprietary | Proprietary | Network (pgr_drivingDistance + ST_ConcaveHull) |
| Traffic-aware | Yes (drive) | Yes (auto) | Yes | Limited | No | Yes (drive, unique for self-hosted) |
| Edge-based view | No | No | No | No | No | **Possible differentiator** |
| POI overlay | No (via other APIs) | No | Yes | Yes (250M POIs) | No | No (anti-feature) |
| Reverse isochrone | No | Yes | Yes | No | No | No (anti-feature) |
| Self-hosted | No (SaaS) | Yes (OSS) | No (SaaS) | No (SaaS) | Yes (OSS) | **Yes** |
| Cost | Per-request pricing | Free (self-hosted) | Per-request pricing | Subscription | Free | **Free** |

### NYC Open Routing's Niche

The differentiators for this project are:
1. **NYC-specific network data** (LION dataset) -- more accurate for NYC than OSM-based tools
2. **Traffic-aware isochrones** using real NYC DOT traffic data -- no other self-hosted tool offers this
3. **Edge-based visualization** -- shows actual reachable streets rather than polygon approximations
4. **Integrated with existing routing** -- same app does point-to-point and reachability, switching between them seamlessly

---

## Sources

- [pgr_drivingDistance - pgRouting Manual 3.8](https://access.crunchydata.com/documentation/pgrouting/3.8.0/pgr_drivingDistance.html) -- Function signature, algorithm (Dijkstra-based), return columns, directed/equicost options
- [Valhalla Isochrone API Reference](https://valhalla.github.io/valhalla/api/isochrone/api-reference/) -- Contour parameters, costing models, denoise/generalize options, GeoJSON response format
- [Mapbox Isochrone API Documentation](https://docs.mapbox.com/api/navigation/isochrone/) -- 4-contour max, 60-min max, profiles, rate limits, polygon vs linestring output
- [Mapbox Isochrone Tutorial](https://docs.mapbox.com/help/tutorials/get-started-isochrone-api/) -- Reference implementation with mode selector and time controls
- [Visualize Travel Time with Isochrones in MapLibre GL JS - Stadia Maps](https://docs.stadiamaps.com/tutorials/display-isochrones-on-a-map/) -- Fill layer implementation, color assignment via feature properties, 3-band example (5/10/15 min)
- [PostGIS ST_ConcaveHull](https://postgis.net/docs/ST_ConcaveHull.html) -- Concave hull for polygon generation from node points
- [PostGIS ST_AlphaShape](https://postgis.net/docs/ST_AlphaShape.html) -- Alpha shape alternative (requires SFCGAL)
- [Isochrones are not Alpha Shapes - Darafei Praliaskouski](https://www.patreon.com/posts/isochrones-are-20933638) -- Why alpha shapes are flawed for isochrones (don't nest, miss holes)
- [Isochrone Map UX Patterns](https://ux-patterns.webgeodatavore.com/isochrone-map/index.html) -- Definition and common usage patterns
- [Dataviz Catalogue: Isochrone Maps](https://datavizcatalogue.com/blog/isochrone-maps/) -- Visualization approaches (polygon, heatmap, colored streets), color coding patterns
- [ColorBrewer](https://colorbrewer2.org/) -- Colorblind-safe sequential palettes for 4-class isochrone bands
- [GraphHopper: High Precision Reachability with deck.gl](https://www.graphhopper.com/blog/2018/07/04/high-precision-reachability/) -- Edge-based vs polygon visualization, Voronoi cell approach
- [Smappen Features](https://www.smappen.com/features/) -- POI overlay, demographic analysis, multi-origin (anti-feature reference)
- [TravelTime Products](https://traveltime.com/products) -- Multi-polygon output, transit support (feature comparison reference)
- [OpenRouteService](https://openrouteservice.org/) -- Open-source isochrone generation, 10-interval/60-min limits
- [Isochrone OpenStreetMap Wiki](https://wiki.openstreetmap.org/wiki/Isochrone) -- Edge-based coloring alternative, community tool listings
- [Wikipedia: Isochrone Map](https://en.wikipedia.org/wiki/Isochrone_map) -- Definition, history, use in urban planning

---
*Feature research for: NYC Open Routing Isochrone/Reachability Milestone*
*Researched: 2026-02-13*
