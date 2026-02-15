# Traffic Data Audit Report

**Date:** 2026-02-15
**Phase:** 19 - Volume Data Audit
**Audit Script:** `scripts/audit_traffic_coverage.sql`

## Data Sources

### Source 1: Live Speed Data (TRANSCOM)

- **Origin:** NYC DOT TRANSCOM sensors via Socrata API (`i4gi-tjb9`)
- **Update frequency:** Every N minutes (configurable via `TRAFFIC_REFRESH_INTERVAL`, default 300s)
- **Storage:** `edges.traffic_factor` column, live-updated by `TrafficRefreshService`
- **How factors are computed:** `posted_speed / observed_speed`, clamped to [1.0, 3.0]
- **Coverage:** 10,923 driveable edges (6.76%)
- **Behavior:** Each refresh cycle atomically updates matched edges and resets unmatched driveable edges to 1.0

### Source 2: Static Volume Data (NYC DOT Traffic Counts)

- **Origin:** NYC DOT traffic volume CSV, imported via `--download-traffic` flag during LION data setup
- **Update frequency:** One-time import during network creation
- **Storage:** `avg_traffic_by_segment` table (segment_id x hour_of_day x day_of_week -> avg_volume)
- **How factors are computed:** Hardcoded volume-to-factor thresholds in SQL functions: `<58 -> 1.0`, `<129 -> 1.2`, `<250 -> 1.5`, `<415 -> 2.0`, `>=415 -> 3.0`
- **Coverage:** 3,488 driveable edges (2.16%) via 3,360 distinct segments
- **Table size:** 274,424 rows (segment x hour x day combinations)

## Coverage Analysis

Audit run against live database on 2026-02-15. Both data sources are imported in this environment.

| Metric | Count | % of Driveable |
|--------|------:|---------------:|
| Total driveable edges | 161,512 | 100.00% |
| With live speed data | 10,923 | 6.76% |
| With static volume data | 3,488 | 2.16% |
| With both sources | 126 | 0.08% |
| With speed data only | 10,797 | 6.68% |
| With volume data only | 3,362 | 2.08% |
| No traffic data | 147,227 | 91.16% |

### Speed Data Distribution

| Factor Bucket | Edge Count | Avg Factor | Min | Max |
|--------------|----------:|----------:|----:|----:|
| 1.01-1.20 (light) | 1,765 | 1.094 | 1.010 | 1.200 |
| 1.21-1.50 (moderate) | 1,847 | 1.338 | 1.210 | 1.500 |
| 1.51-2.00 (heavy) | 2,782 | 1.734 | 1.510 | 2.000 |
| 2.01-3.00 (severe) | 4,529 | 2.760 | 2.010 | 3.000 |

The speed data skews toward severe congestion (41.5% of covered edges at 2.01-3.00). This is expected because TRANSCOM sensors are concentrated on highways and major arterials where congestion is most pronounced.

### Current traffic_factor Column State

| Metric | Value |
|--------|------:|
| Total driveable | 161,512 |
| NULL factor | 0 |
| Factor = 1.0 | 150,589 |
| Factor > 1.0 | 10,923 |
| Average factor | 1.0669 |
| Max factor | 3.0000 |

## Conflict Analysis

The two data sources share a single column (`edges.traffic_factor`) with no source attribution. The live speed service (`TrafficRefreshService`) resets ALL uncovered driveable edges to `traffic_factor = 1.0` each refresh cycle. This destroys any volume-derived factors that were set during LION import.

**Evidence from audit:**
- 3,362 out of 3,488 edges with volume data (96.39%) currently have `traffic_factor = 1.0`
- Only 126 edges (3.61%) have both speed and volume data, meaning these are the only volume-covered edges that retained a non-1.0 factor (because the speed service independently matched them too)
- The volume import's `process_traffic_data()` function writes factors to `edges.traffic_factor` at import time, but the next speed refresh cycle overwrites them

**Root cause:** Both pipelines assume exclusive ownership of `edges.traffic_factor`. The volume import sets it during network creation; the speed refresh resets it every cycle. Last writer wins, and the speed service runs continuously.

## Current SQL Fallback Chain

The three SQL functions that use traffic data (`getdrivingroute_with_traffic`, `getdrivingisochrone`, `getdrivingisochrone_edges`) all use this priority:

```
1. Dynamic volume lookup from avg_traffic_by_segment (time-of-day aware)
   - Subquery joins edges.segmentid to avg_traffic_by_segment.segment_id
   - Uses hardcoded volume thresholds: <58 -> 1.0, <129 -> 1.2, <250 -> 1.5, <415 -> 2.0, >=415 -> 3.0
   - Only runs when _hour and _day_of_week params are both non-NULL

2. COALESCE(edges.traffic_factor, 1.0)
   - Falls back to whatever is in the column (currently speed-derived)

3. 1.0 default (no traffic penalty)
```

**Problem 1: Priority is backwards.** The SQL chain prefers volume data (step 1) over speed data (step 2). Live speed data is more direct (actual speed ratio) and more current (refreshed every 5 minutes) than volume data (proxy factor derived from static traffic counts via hardcoded percentile thresholds).

**Problem 2: Volume lookup adds complexity for minimal coverage.** The dynamic volume lookup adds 6 CASE/WHEN blocks with hardcoded thresholds (58, 129, 250, 415) that are baked into the SQL function definitions. These thresholds were derived from a one-time percentile calculation during LION import and become stale if volume data changes. This violates the project's own guideline: "Never use absolute hardcoded thresholds for traffic volume classification."

**Problem 3: Volume data is effectively dead.** Since the speed service resets 96.39% of volume-covered edges to 1.0, the only time volume data could matter is when `_hour` and `_day_of_week` are passed AND the edge has a segmentid match in `avg_traffic_by_segment`. Even then, it overrides whatever the speed service computed, which is backwards.

## Recommended Fallback Chain (AUDIT-02)

```
1. Live speed factor from edges.traffic_factor (updated by TrafficRefreshService)
   - Most direct signal: actual speed / posted speed ratio
   - Updated every 5 minutes from real sensor data

2. Static volume factor from avg_traffic_by_segment lookup (gap-fill)
   - Only for edges NOT covered by speed sensors
   - Provides time-of-day awareness that speed data lacks

3. 1.0 default (no traffic penalty)
```

However, implementing this fallback chain correctly is complex because:
- The speed service resets uncovered edges to 1.0, so `traffic_factor = 1.0` could mean "no speed data" OR "free flow speed"
- There is no way to distinguish "speed service actively computed 1.0" from "speed service doesn't cover this edge"
- Volume data's unique value (time-of-day granularity) only applies when the API receives `_hour` and `_day_of_week` parameters

## Recommendation (AUDIT-03)

**DEPRECATE** the dynamic volume lookup from the SQL fallback chain.

### Rationale

1. **Negligible unique coverage.** Volume data provides unique coverage for only 3,362 edges (2.08% of driveable edges). Speed data covers 3x more edges (10,923, 6.76%) with zero overlap on most volume edges.

2. **Minimal overlap means minimal gap-fill value.** Only 126 edges (0.08%) have both sources. The volume data does not meaningfully supplement speed data -- they cover almost entirely different parts of the network.

3. **Volume data is already dead in practice.** The speed service has overwritten 96.39% of volume-derived factors to 1.0. The volume import's contribution to `edges.traffic_factor` is erased every refresh cycle.

4. **Complexity cost is high.** The dynamic volume lookup adds 6 CASE/WHEN blocks with hardcoded thresholds across 3 SQL functions (18 total threshold references). These violate the project's percentile-based threshold guideline and make the functions harder to maintain.

5. **The time-of-day feature has no consumer.** The API's `use_traffic` parameter triggers the traffic-aware route function, but the frontend does not pass `_hour` or `_day_of_week` parameters. The dynamic volume lookup's time-of-day awareness is unused in practice.

### Concrete Actions for Plan 02

1. **Remove** the `avg_traffic_by_segment` subquery and all CASE/WHEN volume threshold blocks from:
   - `getdrivingroute_with_traffic()` (3 occurrences)
   - `getdrivingisochrone()` (1 occurrence)
   - `getdrivingisochrone_edges()` (1 occurrence)

2. **Simplify** the traffic cost calculation in all three functions to:
   ```sql
   cost_drive * COALESCE(traffic_factor, 1.0) AS cost
   ```

3. **Remove** the `_hour` and `_day_of_week` parameters from function signatures (or keep for future use but remove the volume lookup body).

4. **Keep** the `--download-traffic` import code and `avg_traffic_by_segment` table as-is. The table has valid data that may be useful for future features (e.g., historical traffic patterns, time-of-day predictions). Just stop querying it in the routing functions.

5. **Keep** the `traffic_volumes` table and import pipeline. Deprecation here means removing from the real-time routing path, not deleting the data.
