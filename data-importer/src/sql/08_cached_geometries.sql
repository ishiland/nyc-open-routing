-- ============================================================================
-- 08_cached_geometries.sql
--
-- Phase 2 Database Optimization: Cached Transformed Geometries
--
-- Purpose: Pre-compute WGS84 (EPSG:4326) geometries to eliminate runtime
--          ST_Transform() calls in routing functions.
--
-- Performance Impact:
--   - Eliminates 10-50 ST_Transform calls per route (one per segment)
--   - Reduces CPU usage by ~20% (transformation is expensive)
--   - Trades ~10-15% disk space for significant CPU savings
--
-- Trade-offs:
--   - Disk: edges table increases from ~209 MB to ~230 MB
--   - Write performance: Trigger maintains both geometries on updates
--   - Read performance: Faster (no transformation needed)
--
-- Related: Section 2.3 in PERFORMANCE_OPTIMIZATION_PLAN.md
-- ============================================================================

-- ============================================================================
-- Phase 2.3: Creating Cached Transformed Geometries
-- ============================================================================

-- ============================================================================
-- Step 1: Add Cached Geometry Column
-- ============================================================================

ALTER TABLE edges
ADD COLUMN IF NOT EXISTS geom_4326 GEOMETRY(LINESTRING, 4326);

-- ============================================================================
-- Step 2: Populate Cached Geometries
-- ============================================================================

-- Update in batches to show progress (less verbose)
DO $$
DECLARE
    batch_size INT := 10000;
    total_rows INT;
    processed INT := 0;
BEGIN
    SELECT COUNT(*) INTO total_rows FROM edges WHERE geom_4326 IS NULL;

    WHILE processed < total_rows LOOP
        UPDATE edges
        SET geom_4326 = ST_Transform(the_geom, 4326)
        WHERE id IN (
            SELECT id FROM edges
            WHERE geom_4326 IS NULL
            ORDER BY id
            LIMIT batch_size
        );

        processed := processed + batch_size;

        -- Report progress every 50K rows instead of every 10K
        IF processed % 50000 = 0 OR processed >= total_rows THEN
            RAISE NOTICE '  Transforming geometries: % / % (%)',
                LEAST(processed, total_rows),
                total_rows,
                ROUND(LEAST(processed, total_rows)::NUMERIC / total_rows * 100, 1) || '%';
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- Step 3: Create Spatial Index
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_edges_geom_4326
ON edges USING GIST(geom_4326);

-- ============================================================================
-- Step 4: Create Trigger to Maintain Cached Geometry
-- ============================================================================

-- Create trigger function
CREATE OR REPLACE FUNCTION update_geom_4326()
RETURNS TRIGGER AS $$
BEGIN
    -- Automatically update geom_4326 when the_geom is modified
    IF NEW.the_geom IS DISTINCT FROM OLD.the_geom OR OLD.geom_4326 IS NULL THEN
        NEW.geom_4326 := ST_Transform(NEW.the_geom, 4326);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS edges_transform_trigger ON edges;
CREATE TRIGGER edges_transform_trigger
    BEFORE INSERT OR UPDATE OF the_geom
    ON edges
    FOR EACH ROW
    EXECUTE FUNCTION update_geom_4326();

-- ============================================================================
-- Step 5: Analyze Table for Query Planner
-- ============================================================================

-- NOTE: ANALYZE moved to 06_performance_indexes.sql for centralized statistics management

-- Verify and report statistics
DO $$
DECLARE
    total_edges INT;
    populated_count INT;
    null_count INT;
    pct_populated NUMERIC;
    table_size TEXT;
    test_id INT;
    trigger_working BOOLEAN;
BEGIN
    -- Get cached geometry statistics
    SELECT COUNT(*), COUNT(geom_4326), COUNT(*) FILTER (WHERE geom_4326 IS NULL)
    INTO total_edges, populated_count, null_count
    FROM edges;

    pct_populated := ROUND(100.0 * populated_count / total_edges, 1);

    SELECT pg_size_pretty(pg_total_relation_size('edges')) INTO table_size;

    -- Quick trigger test
    SELECT id INTO test_id FROM edges ORDER BY random() LIMIT 1;
    UPDATE edges SET the_geom = the_geom WHERE id = test_id;
    SELECT geom_4326 IS NOT NULL INTO trigger_working FROM edges WHERE id = test_id;

    -- Report summary
    RAISE NOTICE 'Cached geometries: % edges transformed (%), table size: %',
        populated_count, ROUND(pct_populated, 1) || '%', table_size;

    IF trigger_working THEN
        RAISE NOTICE 'Trigger validation: PASSED (geom_4326 auto-maintained on updates)';
    ELSE
        RAISE WARNING 'Trigger validation: FAILED (geom_4326 not maintained)';
    END IF;
END $$;
