# NYC Open Routing - Travel Time & Cost Analysis

## Current Implementation Review

### Travel Time Calculations

**Walking Speed: 3 mph** ([02_travel_time.sql:55](data-importer/src/sql/02_travel_time.sql#L55))
```sql
time_walk = (length_feet / 5280) / 0.05  -- 3/60 = 0.05 hours per mile
```
- **Analysis**: 3 mph is a reasonable average walking speed
- **Consideration**: Could vary by terrain (hills), crosswalks, or pedestrian density
- **Recommendation**: ✅ Keep as-is for now

**Biking Speed: 12 mph** ([02_travel_time.sql:54](data-importer/src/sql/02_travel_time.sql#L54))
```sql
time_bike = (length_feet / 5280) / 0.2  -- 12/60 = 0.2 hours per mile
```
- **Analysis**: 12 mph is conservative for urban cycling
- **Issues**: Doesn't account for:
  - Protected bike lanes (could be faster, ~15 mph)
  - Shared lanes with traffic (might be slower, ~8-10 mph)
  - Hills/terrain
- **Recommendation**: ⚠️ Consider differentiating by bike lane type

**Driving Speed: Posted Speed Limits** ([02_travel_time.sql:53](data-importer/src/sql/02_travel_time.sql#L53))
```sql
time_drive = (length_feet / 5280) / (posted_speed / 60)
```
- **Analysis**: Uses actual posted speed limits
- **Issues**:
  - Doesn't account for traffic (mitigated by traffic_factor)
  - Doesn't account for intersections/stops
  - Speed limits on highways may not reflect actual travel time due to congestion
- **Recommendation**: ⚠️ Consider applying a reduction factor (0.7-0.8x) for realistic speeds

**Ferry Speed: 25 mph** ([02_travel_time.sql:59](data-importer/src/sql/02_travel_time.sql#L59))
```sql
time_bike = (length_feet / 5280) / 0.42  -- 25/60 for ferries
time_walk = (length_feet / 5280) / 0.42  -- Same for walking (waiting time)
```
- **Analysis**: Reasonable ferry speed
- **Note**: Treats bike and walk the same (both use ferry)
- **Recommendation**: ✅ Appropriate

---

## Cost Calculation Analysis

### Driving Costs ([03_cost.sql](data-importer/src/sql/03_cost.sql))

**One-Way Streets** (Lines 9-18)
- Both directions: `cost = time`
- Wrong way: `cost = time * 100` (essentially prohibited)
- **Analysis**: ✅ Correct - 100x penalty effectively blocks wrong-way routing

**Issue**: Null cost handling (Line 20-22)
```sql
UPDATE edges
SET cost_drive = time_drive
WHERE cost_drive is NULL and driveable=TRUE;
```
- **Problem**: Sets costs even for roads that shouldn't be driveable
- **Recommendation**: ⚠️ Add more validation

### Biking Costs ([03_cost.sql:24-72](data-importer/src/sql/03_cost.sql#L24-L72))

**Problem 1: Double Penalty for No Bike Lane** (Lines 54-57)
```sql
UPDATE edges
SET cost_bike = cost_bike * 10,
    rcost_bike = rcost_bike * 10
WHERE bike_trafdir IS NULL OR TRIM(bike_trafdir) = '';
```
- **Issue**: This multiplies by 10x EVEN IF there's already a 100x one-way penalty
- **Result**: Wrong-way on road without bike lane = 1000x penalty (excessive)

**Problem 2: Bike Lane Penalty Applied After** (Lines 60-71)
```sql
UPDATE edges
SET cost_bike = (
    SELECT CASE
        WHEN TRIM(bikelane) = '' THEN cost_bike * 10  -- Another 10x
        WHEN bikelane is NULL THEN cost_bike * 10
        WHEN TRIM(bikelane) = '7' THEN cost_bike * 100  -- Stairs
        ELSE cost_bike
    END
);
```
- **Issue**: Applies penalties sequentially, compounding them
- **Result**: Road without bike_trafdir AND no bikelane = 100x penalty
- **Recommendation**: 🔧 **FIX NEEDED** - Apply penalties in a single UPDATE with combined logic

**Problem 3: Stairs Penalty** (Line 67)
- 100x penalty for stairs (bikelane = '7')
- **Analysis**: ✅ Correct - cyclists can't use stairs easily
- **Note**: Should verify stairs have walkable=TRUE for pedestrians

### Walking Costs ([03_cost.sql:76-78](data-importer/src/sql/03_cost.sql#L76-L78))

```sql
UPDATE edges
SET cost_walk = time_walk;
```
- **Analysis**: Simple time-based cost
- **Missing**:
  - No penalty for non-pedestrian areas (highways)
  - No consideration of crosswalks, signals, or intersections
  - No terrain considerations (hills, stairs)
- **Recommendation**: ⚠️ Add penalties for:
  - Non-pedestrian zones (WHERE nonped = 'V')
  - Major highways (featuretyp indicating limited access)

---

## Recommended Improvements

### 1. Fix Bike Cost Calculation Logic

Replace the multiple sequential UPDATEs with a single comprehensive UPDATE:

```sql
-- Proposed improved bike cost calculation
UPDATE edges
SET cost_bike = CASE
    -- Stairs: High penalty but not impossible
    WHEN TRIM(bikelane) = '7' THEN time_bike * 50

    -- One-way streets (against direction)
    WHEN one_way_bike = 'TF' THEN CASE
        WHEN bikelane IS NOT NULL AND TRIM(bikelane) != ''
            THEN time_bike * 10  -- Bike lane against traffic = moderate penalty
        ELSE time_bike * 100  -- No bike lane against traffic = blocked
    END

    -- One-way streets (with direction)
    WHEN one_way_bike = 'FT' THEN CASE
        WHEN bikelane IS NOT NULL AND TRIM(bikelane) != ''
            THEN time_bike * 1.0  -- Bike lane with traffic = good
        ELSE time_bike * 5.0  -- No bike lane with traffic = moderate penalty
    END

    -- Both directions
    WHEN one_way_bike = 'B' THEN CASE
        WHEN bikelane IS NOT NULL AND TRIM(bikelane) != ''
            THEN time_bike * 1.0  -- Bike lane = preferred
        ELSE time_bike * 3.0  -- No bike lane = slight penalty
    END

    ELSE time_bike * 3.0  -- Default: moderate penalty
END
WHERE bikeable = TRUE;
```

### 2. Add Walking Penalties

```sql
-- Proposed walking cost improvements
UPDATE edges
SET cost_walk = CASE
    -- Highways and limited access roads
    WHEN featuretyp IN ('1', '2', '3')  -- Major roads
        THEN time_walk * 100  -- Effectively blocked

    -- Non-pedestrian zones
    WHEN nonped = 'V'
        THEN time_walk * 100  -- Blocked

    -- Stairs (walkable but slower)
    WHEN TRIM(bikelane) = '7'  -- Reuse bikelane field for stairs
        THEN time_walk * 2.0  -- Takes longer but possible

    -- Normal pedestrian paths
    ELSE time_walk * 1.0
END
WHERE walkable = TRUE;
```

### 3. Adjust Driving Realism Factor

```sql
-- Add realism factor for driving (account for stops, traffic lights)
UPDATE edges
SET time_drive = time_drive * CASE
    WHEN featuretyp IN ('1', '2')  -- Highways/freeways
        THEN 0.85  -- Less stopping
    WHEN posted_speed >= 40
        THEN 0.80  -- Arterial roads
    ELSE 0.70  -- Local streets with frequent stops
END
WHERE driveable = TRUE;
```

### 4. Differentiate Bike Speeds by Lane Type

```sql
-- Adjust bike travel times based on infrastructure
UPDATE edges
SET time_bike = CASE
    -- Protected bike lanes (faster)
    WHEN bikelane IN ('1', '2')  -- Protected/separated lanes
        THEN (length_feet / 5280) / 0.25  -- 15 mph

    -- Standard bike lanes
    WHEN bikelane IN ('3', '4', '5')  -- Standard lanes
        THEN (length_feet / 5280) / 0.20  -- 12 mph

    -- Shared roadway (slower)
    ELSE (length_feet / 5280) / 0.15  -- 9 mph
END
WHERE bikeable = TRUE;
```

---

## Performance Optimization Notes

### Current Index Coverage

**Good**:
- Geometry index on `the_geom` (GIST)
- Indexes on `source` and `target` (BTREE)

**Added in Phase 1**:
- Composite index on `(source, target)`
- Mode-specific indexes on `driveable`, `bikeable`, `walkable`
- Cost indexes for query optimization

### Query Performance Expectations

Based on NYC network size (~241,442 segments):
- **Simple route (< 1 mile)**: 50-200ms
- **Medium route (1-5 miles)**: 200-500ms
- **Long route (5-20 miles)**: 500ms-2s
- **Cross-borough route**: 1-3s

### pgRouting Algorithm: pgr_trsp

**Turn-Restricted Shortest Path** - Current implementation is appropriate:
- Handles one-way streets ✅
- Handles turn restrictions at grade-separated intersections ✅
- Uses Dijkstra's algorithm with restrictions ✅

**Alternative to Consider**: `pgr_dijkstra` for routes without turn restrictions (faster)
- Could use for walking routes (fewer restrictions)
- Would require separate routing functions

---

## Testing Recommendations

### Unit Tests Needed

1. **Cost Calculation Validation**
   - Test that one-way penalties are correct
   - Verify bike lane penalties are reasonable
   - Ensure no cost explosions (> 1000x)

2. **Edge Cases**
   - Routes requiring ferries
   - Routes across bridges (especially grade-separated)
   - Routes through tunnels
   - Dead-end streets
   - Disconnected graph components

3. **Cross-Mode Comparisons**
   - Same origin/destination across all modes
   - Verify walking is slowest, driving is fastest
   - Check that bike routes prefer bike lanes

### Integration Tests Needed

1. **Known NYC Routes**
   - Times Square to Empire State Building
   - Manhattan to Brooklyn (over Manhattan Bridge)
   - JFK Airport to Midtown
   - Bronx to Staten Island (requiring multiple bridges)

2. **Performance Benchmarks**
   - 100 random routes under 1 mile
   - 100 random routes 1-5 miles
   - 10 cross-borough routes

---

## Priority Actions

### High Priority
1. 🔧 Fix bike cost calculation compounding issue
2. ⚠️ Add walking penalties for highways/non-ped zones
3. ✅ Run analysis_queries.sql to validate data quality

### Medium Priority
4. ⚠️ Add driving realism factor (0.7-0.8x)
5. ⚠️ Differentiate bike speeds by lane type
6. 📊 Profile query performance with EXPLAIN ANALYZE

### Low Priority
7. 📝 Document speed assumptions in README
8. 🧪 Create automated test suite for routing
9. 📈 Add telemetry to track actual route calculation times

---

## Files to Modify

- [data-importer/src/sql/03_cost.sql](data-importer/src/sql/03_cost.sql) - Fix bike cost calculation
- [data-importer/src/sql/02_travel_time.sql](data-importer/src/sql/02_travel_time.sql) - Add realism factors
- [data-importer/src/sql/analysis_queries.sql](data-importer/src/sql/analysis_queries.sql) - New profiling queries (created)
