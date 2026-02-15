-- ============================================================================
-- 07_vertex_accessibility.sql
--
-- Phase 2 Database Optimization: Vertex Accessibility Flags
--
-- Purpose: Pre-compute mode-specific accessibility for vertices to eliminate
--          expensive EXISTS subqueries in node snapping functions.
--
-- Performance Impact:
--   - Eliminates Nested Loop Semi Join (subquery on edges table)
--   - Enables partial GiST indexes for better selectivity
--   - Expected: 50-70% reduction in node snapping time
--
-- Related: Section 2.2 in PERFORMANCE_OPTIMIZATION_PLAN.md
-- ============================================================================

-- ============================================================================
-- Phase 2.2: Creating Vertex Accessibility Flags
-- ============================================================================

-- ============================================================================
-- Step 1: Add Accessibility Columns
-- ============================================================================

ALTER TABLE edges_vertices_pgr
ADD COLUMN IF NOT EXISTS has_driveable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_bikeable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_walkable BOOLEAN DEFAULT FALSE;

-- ============================================================================
-- Step 2: Populate Accessibility Flags
-- ============================================================================

-- Update has_driveable flag
-- A vertex has driveable access if ANY connected edge is driveable
UPDATE edges_vertices_pgr v
SET has_driveable = EXISTS (
    SELECT 1 FROM edges e
    WHERE (e.source = v.id OR e.target = v.id)
      AND e.driveable = TRUE
);

-- Update has_bikeable flag
-- A vertex has bikeable access if ANY connected edge is bikeable
UPDATE edges_vertices_pgr v
SET has_bikeable = EXISTS (
    SELECT 1 FROM edges e
    WHERE (e.source = v.id OR e.target = v.id)
      AND e.bikeable = TRUE
);

-- Update has_walkable flag
-- A vertex has walkable access if ANY connected edge is walkable
UPDATE edges_vertices_pgr v
SET has_walkable = EXISTS (
    SELECT 1 FROM edges e
    WHERE (e.source = v.id OR e.target = v.id)
      AND e.walkable = TRUE
);

-- ============================================================================
-- Step 3: Create Partial GiST Indexes
-- ============================================================================

-- Drop old generic index if it exists (will be replaced by partial indexes)
DROP INDEX IF EXISTS edges_vertices_pgr_geom_idx;

-- Create partial indexes (only include accessible vertices)
-- These are much smaller and more selective than full table index
CREATE INDEX IF NOT EXISTS idx_vertices_driveable_geom
ON edges_vertices_pgr USING GIST(geom)
WHERE has_driveable = TRUE;

CREATE INDEX IF NOT EXISTS idx_vertices_bikeable_geom
ON edges_vertices_pgr USING GIST(geom)
WHERE has_bikeable = TRUE;

CREATE INDEX IF NOT EXISTS idx_vertices_walkable_geom
ON edges_vertices_pgr USING GIST(geom)
WHERE has_walkable = TRUE;

-- ============================================================================
-- Step 4: Analyze Table for Query Planner
-- ============================================================================

-- NOTE: ANALYZE moved to 06_performance_indexes.sql for centralized statistics management

-- Report summary statistics
DO $$
DECLARE
    total_vertices INT;
    driveable_count INT;
    bikeable_count INT;
    walkable_count INT;
    pct_driveable NUMERIC;
    pct_bikeable NUMERIC;
    pct_walkable NUMERIC;
BEGIN
    SELECT
        COUNT(*),
        COUNT(*) FILTER (WHERE has_driveable),
        COUNT(*) FILTER (WHERE has_bikeable),
        COUNT(*) FILTER (WHERE has_walkable)
    INTO total_vertices, driveable_count, bikeable_count, walkable_count
    FROM edges_vertices_pgr;

    pct_driveable := ROUND(100.0 * driveable_count / total_vertices, 1);
    pct_bikeable := ROUND(100.0 * bikeable_count / total_vertices, 1);
    pct_walkable := ROUND(100.0 * walkable_count / total_vertices, 1);

    RAISE NOTICE 'Vertex accessibility: % total (% driveable, % bikeable, % walkable)',
        total_vertices, pct_driveable || '%', pct_bikeable || '%', pct_walkable || '%';
    RAISE NOTICE 'Partial indexes created for optimized mode-specific node snapping';
END $$;
