-- Performance optimization indexes for routing queries (v2)
-- These covering indexes enable index-only scans for 2-5x performance improvement
--
-- CENTRALIZED INDEX MANAGEMENT: All indexes are created here for clarity and maintainability
-- Indexes are created AFTER all data transformations (edges, topology, restrictions) are complete

---------------------------------------------
-- Basic Indexes (from 01_edges.sql, 04_restrictions.sql)
---------------------------------------------
-- Join ID for LION data reference
CREATE INDEX IF NOT EXISTS edges_join_id_idx ON edges (join_id);

-- Geometry spatial index (GIST)
CREATE INDEX IF NOT EXISTS edges_geom_idx ON edges USING GIST (the_geom);

-- Source/target node indexes for topology
CREATE INDEX IF NOT EXISTS edges_source_idx ON edges USING BTREE (source);
CREATE INDEX IF NOT EXISTS edges_target_idx ON edges USING BTREE (target);

-- Feature type for filtering (streets, ferries, etc.)
CREATE INDEX IF NOT EXISTS edges_featuretyp_idx ON edges USING BTREE (featuretyp);

-- Restriction indexes (from 04_restrictions.sql)
CREATE INDEX IF NOT EXISTS idx_restrictions_from_edge ON restrictions (from_edge);
CREATE INDEX IF NOT EXISTS idx_restrictions_to_edge ON restrictions (to_edge);
CREATE INDEX IF NOT EXISTS idx_restrictions_composite ON restrictions (from_edge, to_edge, via_node);

---------------------------------------------
-- Covering Indexes for pgRouting Queries
---------------------------------------------
-- These indexes include all columns needed by pgr_trsp, allowing
-- the query planner to use index-only scans without heap lookups

-- Driving mode covering index
-- Used by: pgr_trsp for driving routes
-- Columns: mode filter, source/target for graph traversal, cost for Dijkstra
CREATE INDEX IF NOT EXISTS idx_edges_drive_covering
ON edges(source, target, cost_drive, rcost_drive)
WHERE driveable = TRUE;

-- Biking mode covering index
CREATE INDEX IF NOT EXISTS idx_edges_bike_covering
ON edges(source, target, cost_bike, rcost_bike)
WHERE bikeable = TRUE;

-- Walking mode covering index
CREATE INDEX IF NOT EXISTS idx_edges_walk_covering
ON edges(source, target, cost_walk, rcost_walk)
WHERE walkable = TRUE;

---------------------------------------------
-- Supporting Indexes
---------------------------------------------
-- Composite index for bidirectional lookups
CREATE INDEX IF NOT EXISTS idx_edges_source_target ON edges(source, target);

-- Index on street name for turn-by-turn directions
CREATE INDEX IF NOT EXISTS idx_edges_street ON edges(street) WHERE street IS NOT NULL;

---------------------------------------------
-- Statistics for Query Planner
---------------------------------------------
-- Update query planner statistics to help PostgreSQL choose optimal plans
ANALYZE edges;
ANALYZE edges_vertices_pgr;
DO $$
BEGIN
    IF to_regclass('public.restrictions') IS NOT NULL THEN
        EXECUTE 'ANALYZE restrictions';
    END IF;
END $$;

-- Create extended statistics for correlated columns
-- This helps with queries that filter on multiple related columns
CREATE STATISTICS IF NOT EXISTS edges_drive_stats (dependencies)
ON driveable, source, target, cost_drive FROM edges;

CREATE STATISTICS IF NOT EXISTS edges_bike_stats (dependencies)
ON bikeable, source, target, cost_bike FROM edges;

CREATE STATISTICS IF NOT EXISTS edges_walk_stats (dependencies)
ON walkable, source, target, cost_walk FROM edges;

-- Refresh statistics
ANALYZE edges;
