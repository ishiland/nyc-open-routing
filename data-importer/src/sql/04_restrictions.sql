---------------------------------------------
--          PRE-FLIGHT VALIDATION
---------------------------------------------
-- Ensure topology and level columns exist before creating restrictions
DO $$
DECLARE
    edges_count INTEGER;
    vertex_table_exists BOOLEAN;
    vertex_count INTEGER;
    missing_source INTEGER;
    missing_target INTEGER;
    missing_level_from INTEGER;
    missing_level_to INTEGER;
    driveable_count INTEGER;
BEGIN
    -- Check if edges table exists and has data
    SELECT COUNT(*) INTO edges_count FROM public.edges;
    IF edges_count = 0 THEN
        RAISE EXCEPTION 'Cannot create restrictions: edges table is empty';
    END IF;

    -- Check if topology has been created (edges_vertices_pgr table exists)
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'edges_vertices_pgr'
    ) INTO vertex_table_exists;

    IF NOT vertex_table_exists THEN
        RAISE EXCEPTION 'Cannot create restrictions: Topology not created. Run topology creation step first.';
    END IF;

    -- Check if vertex table has data
    SELECT COUNT(*) INTO vertex_count FROM public.edges_vertices_pgr;
    IF vertex_count = 0 THEN
        RAISE EXCEPTION 'Cannot create restrictions: edges_vertices_pgr table is empty';
    END IF;

    -- Check for missing source/target nodes
    SELECT COUNT(*) INTO missing_source FROM public.edges WHERE source IS NULL;
    SELECT COUNT(*) INTO missing_target FROM public.edges WHERE target IS NULL;

    IF missing_source > 0 THEN
        RAISE EXCEPTION 'Cannot create restrictions: % edges missing source node', missing_source;
    END IF;

    IF missing_target > 0 THEN
        RAISE EXCEPTION 'Cannot create restrictions: % edges missing target node', missing_target;
    END IF;

    -- Check for missing level columns (required for grade separation)
    SELECT COUNT(*) INTO missing_level_from FROM public.edges WHERE level_from IS NULL;
    SELECT COUNT(*) INTO missing_level_to FROM public.edges WHERE level_to IS NULL;

    IF missing_level_from > 0 THEN
        RAISE WARNING 'Found % edges with NULL level_from', missing_level_from;
    END IF;

    IF missing_level_to > 0 THEN
        RAISE WARNING 'Found % edges with NULL level_to', missing_level_to;
    END IF;

    -- Check for driveable edges (restrictions only apply to driving)
    SELECT COUNT(*) INTO driveable_count FROM public.edges WHERE driveable = TRUE;
    IF driveable_count = 0 THEN
        RAISE WARNING 'No driveable edges found - turn restrictions will be empty';
    END IF;

    RAISE NOTICE 'Pre-flight validation passed: % edges, % vertices, % driveable edges',
                 edges_count, vertex_count, driveable_count;
END $$;

---------------------------------------------
--        CREATE RESTRICTIONS TABLE
---------------------------------------------
-- Drop any existing table and dependent views so repeated runs don't error out
DROP TABLE IF EXISTS public.restrictions CASCADE;

-- Create the turn‑restrictions table
CREATE TABLE public.restrictions (
  id         BIGSERIAL PRIMARY KEY,   -- unique restriction ID
  from_edge  BIGINT    NOT NULL,      -- edge you're coming from
  to_edge    BIGINT    NOT NULL,      -- edge you're turning onto
  via_node   INTEGER   NOT NULL,      -- the intersection node

  -- UNIQUE constraint to prevent duplicate restrictions
  CONSTRAINT unique_restriction UNIQUE (from_edge, to_edge, via_node)
);

-- NOTE: Indexes moved to 06_performance_indexes.sql for centralized management

-- Create view for routing functions (DRY principle - used in all 4 routing functions)
CREATE OR REPLACE VIEW restrictions_for_routing AS
SELECT
    ARRAY[from_edge, to_edge]::BIGINT[] AS path,
    1000000.0::FLOAT AS cost  -- High penalty effectively blocks restricted turns
FROM restrictions;

-- Populate turn restrictions based on grade-separated intersections
-- Restrictions are generated for DRIVEABLE edges only, then filtered per mode
-- Logic: When edges connect at a node but are at different vertical levels,
-- and neither is a ramp/ferry, the turn is restricted (e.g., can't turn from street to elevated highway)
--
-- Each edge touches two nodes (source and target) with a level at each end.
-- We must generate restrictions for ALL edge pairs sharing a node at different
-- levels, not just forward→forward (e1.target = e2.source). Edges can share a
-- node via any combination: source-source, source-target, target-source, or
-- target-target. Missing combinations cause grade separation violations.
--
-- Mode-specific filtering applied via views:
-- - Driving: All driveable restrictions (this table)
-- - Biking: Subset where both edges are bikeable
-- - Walking: None (pedestrians can use stairs/overpasses)
INSERT INTO public.restrictions (from_edge, to_edge, via_node)
WITH edge_at_node AS (
    SELECT id, source AS node_id, level_from AS level_at_node,
           rw_type, featuretyp, driveable
    FROM edges
    UNION ALL
    SELECT id, target AS node_id, level_to AS level_at_node,
           rw_type, featuretyp, driveable
    FROM edges
)
SELECT DISTINCT
    a.id AS from_edge,
    b.id AS to_edge,
    a.node_id AS via_node
FROM edge_at_node a
JOIN edge_at_node b ON a.node_id = b.node_id
WHERE a.level_at_node != b.level_at_node  -- Different vertical levels at shared node
  AND a.id != b.id                        -- Not the same edge
  AND a.driveable = TRUE                  -- Both edges must be driveable
  AND b.driveable = TRUE
  AND a.level_at_node IS NOT NULL         -- Exclude generic segments (*)
  AND b.level_at_node IS NOT NULL
  AND a.rw_type != '9'                   -- Exclude ramps (valid transitions)
  AND b.rw_type != '9'
  AND a.featuretyp != 'F'                -- Exclude ferries
  AND b.featuretyp != 'F';

---------------------------------------------
--      CREATE MODE-SPECIFIC VIEWS
---------------------------------------------
-- Driving: Use all restrictions (already filtered to driveable edges)
CREATE OR REPLACE VIEW restrictions_for_driving AS
SELECT path, cost FROM restrictions_for_routing;

-- Biking: Only restrictions where both edges are bikeable
CREATE OR REPLACE VIEW restrictions_for_biking AS
SELECT r.path, r.cost
FROM restrictions_for_routing r
WHERE EXISTS (
    SELECT 1 FROM edges WHERE id = (r.path)[1] AND bikeable = TRUE
)
AND EXISTS (
    SELECT 1 FROM edges WHERE id = (r.path)[2] AND bikeable = TRUE
);

-- Walking: Empty view (pedestrians can use stairs, overpasses, etc.)
CREATE OR REPLACE VIEW restrictions_for_walking AS
SELECT ARRAY[]::BIGINT[] as path, 1000000.0::FLOAT as cost WHERE FALSE;

---------------------------------------------
--         LOG STATISTICS
---------------------------------------------
DO $$
DECLARE
    total_restrictions INTEGER;
    driving_restrictions INTEGER;
    biking_restrictions INTEGER;
    same_level_count INTEGER;
    unique_nodes INTEGER;
BEGIN
    -- Count total restrictions
    SELECT COUNT(*) INTO total_restrictions FROM restrictions;

    -- Count mode-specific restrictions
    SELECT COUNT(*) INTO driving_restrictions FROM restrictions_for_driving;
    SELECT COUNT(*) INTO biking_restrictions FROM restrictions_for_biking;

    -- Check for same-level restrictions at the shared via_node (should be zero)
    SELECT COUNT(*) INTO same_level_count
    FROM restrictions r
    JOIN edges e1 ON r.from_edge = e1.id
    JOIN edges e2 ON r.to_edge = e2.id
    WHERE CASE WHEN r.via_node = e1.source THEN e1.level_from
               WHEN r.via_node = e1.target THEN e1.level_to END
        = CASE WHEN r.via_node = e2.source THEN e2.level_from
               WHEN r.via_node = e2.target THEN e2.level_to END;

    -- Count unique restricted nodes
    SELECT COUNT(DISTINCT via_node) INTO unique_nodes FROM restrictions;

    -- Log results
    RAISE NOTICE '=== Turn Restriction Statistics ===';
    RAISE NOTICE 'Total restrictions created: %', total_restrictions;
    RAISE NOTICE 'Driving restrictions: %', driving_restrictions;
    RAISE NOTICE 'Biking restrictions: %', biking_restrictions;
    RAISE NOTICE 'Walking restrictions: 0 (pedestrians can use stairs/overpasses)';
    RAISE NOTICE 'Unique restricted nodes: %', unique_nodes;

    IF same_level_count > 0 THEN
        RAISE WARNING 'Found % same-level restrictions (potential logic issue)', same_level_count;
    END IF;

    RAISE NOTICE '=== 04_restrictions.sql completed successfully ===';
END $$;