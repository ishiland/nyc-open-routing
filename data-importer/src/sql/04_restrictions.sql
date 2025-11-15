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
  via_node   INTEGER   NOT NULL       -- the intersection node
);

-- Add indexes to speed up lookups in the routing functions
CREATE INDEX idx_restrictions_from_edge ON public.restrictions (from_edge);
CREATE INDEX idx_restrictions_to_edge ON public.restrictions (to_edge);

-- Add composite index for better query performance
CREATE INDEX idx_restrictions_composite ON public.restrictions (from_edge, to_edge, via_node);

-- Add UNIQUE constraint to prevent duplicate restrictions
ALTER TABLE public.restrictions
ADD CONSTRAINT unique_restriction UNIQUE (from_edge, to_edge, via_node);

-- Create view for routing functions (DRY principle - used in all 4 routing functions)
CREATE OR REPLACE VIEW restrictions_for_routing AS
SELECT
    ARRAY[from_edge, to_edge]::BIGINT[] AS path,
    1000000.0::FLOAT AS cost  -- High penalty effectively blocks restricted turns
FROM restrictions;

-- Populate turn restrictions based on grade-separated intersections
-- When edges connect at a node but are on different vertical levels,
-- turns between them are restricted (e.g., can't turn from street to bridge)
-- Applies to ALL travel modes (driving, biking, walking)
INSERT INTO public.restrictions (from_edge, to_edge, via_node)
SELECT DISTINCT
    e1.id AS from_edge,
    e2.id AS to_edge,
    e1.target AS via_node
FROM edges e1
JOIN edges e2 ON e1.target = e2.source
WHERE e1.level_to != e2.level_from  -- Different vertical levels
  AND e1.id != e2.id;                -- Not the same edge

-- Also add restrictions for edges meeting at their source nodes
-- This handles cases where two edges share a common source node
INSERT INTO public.restrictions (from_edge, to_edge, via_node)
SELECT DISTINCT
    e1.id AS from_edge,
    e2.id AS to_edge,
    e1.source AS via_node
FROM edges e1
JOIN edges e2 ON e1.source = e2.source  -- Both edges share the same source node
WHERE e1.level_from != e2.level_from    -- Different vertical levels at shared node
  AND e1.id != e2.id                     -- Not the same edge
  AND NOT EXISTS (                        -- Avoid duplicates from first INSERT
    SELECT 1 FROM restrictions r
    WHERE r.from_edge = e1.id
      AND r.to_edge = e2.id
  );

-- Log statistics
DO $$
DECLARE
    restriction_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO restriction_count FROM restrictions;
    RAISE NOTICE 'Created % turn restrictions based on grade separations', restriction_count;
END $$;