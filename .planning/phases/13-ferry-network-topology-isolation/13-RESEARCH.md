# Phase 13: Ferry Network Topology Isolation - Research

**Researched:** 2026-02-14
**Domain:** PostGIS/pgRouting graph topology, LION street network data
**Confidence:** HIGH

## Summary

The problem is well-understood and bounded. `pgr_extractVertices` creates the routing topology by matching edge endpoints based on their 2D geometry coordinates. When LION ferry route segments happen to have start/end points at the same XY coordinates as bridge/tunnel segments (despite being at water level vs. elevated), they receive the same vertex IDs. This allows the routing engine to "jump" from a ferry edge to a bridge/tunnel edge mid-span, producing invalid routes.

The fix is a post-topology SQL step that reassigns ferry internal nodes to new, unique vertex IDs while preserving terminal endpoint connectivity to the street network. This is a surgical modification to `09_ferry_connections.sql` (or a new SQL file) that runs after topology creation. No Python code, frontend code, or routing function changes are needed.

**Primary recommendation:** Add a SQL step in the data import pipeline that identifies ferry edges sharing internal nodes with bridge/tunnel edges, creates fresh vertex IDs for those ferry nodes, and updates the ferry edges' `source`/`target` references accordingly. Terminal nodes (where ferry touches land) are left shared with the street network.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| PostgreSQL | 17 | Database engine | Already in use |
| PostGIS | 3.5 | Spatial operations | Already in use (SRID 2263) |
| pgRouting | 3.8 | Graph routing | Already in use (pgr_extractVertices, pgr_trsp) |

### Supporting

No additional libraries needed. This is purely SQL within the existing stack.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Post-topology node reassignment | Pre-topology geometry offset (shift ferry geom by small amount) | Would break visual accuracy; harder to reason about; affects cached geometries |
| Manual node creation per ferry edge | Turn restrictions between ferry/bridge edges | Already used for grade separation but adds complexity; doesn't truly isolate the graph |
| Modifying pgr_extractVertices tolerance | Nothing | pgr_extractVertices has no tolerance parameter; it matches exact coordinates |

## Architecture Patterns

### Pipeline Integration Point

The existing import pipeline in `create_network.py` runs steps in this order:

```
01_edges.sql          -> Create edges from LION
02_travel_time.sql    -> Calculate travel times + set mode flags
03_cost.sql           -> Calculate routing costs
08_cached_geometries  -> Pre-compute WGS84 geometries
create_topology()     -> pgr_extractVertices (creates vertices + sets source/target)
04_restrictions.sql   -> Turn restrictions for grade separation
07_vertex_accessibility.sql -> has_driveable/bikeable/walkable flags
05_functions.sql      -> Routing functions
09_ferry_connections.sql -> Staten Island Ferry manual connections
06_performance_indexes.sql -> Indexes and statistics
```

The ferry isolation step must run **after topology creation** (source/target are assigned) and **before vertex accessibility flags** (so the new vertices get correct accessibility flags). The best insertion point is between `create_topology()` and `04_restrictions.sql`, or as a modification to `09_ferry_connections.sql`.

### Pattern: Post-Topology Node Reassignment

**What:** After pgr_extractVertices assigns vertex IDs based on 2D coordinate matching, identify ferry edges that share internal (non-terminal) nodes with non-ferry edges (bridges/tunnels), create new vertex rows in `edges_vertices_pgr`, and update the ferry edges' `source`/`target` to point to the new vertices.

**When to use:** When two structurally distinct network features share endpoint coordinates in 2D but should be topologically isolated.

**Algorithm:**

```sql
-- Step 1: Identify ferry nodes (nodes connected to at least one ferry edge)
-- Step 2: Identify which of those are "internal" (connected to ferry AND bridge/tunnel,
--         but NOT connected to regular street edges at ground level)
-- Step 3: For each internal shared node, create a new vertex at the same geometry
-- Step 4: Update ferry edges to point to the new vertex instead of the shared one
-- Step 5: Update the new vertices' in_edges/out_edges arrays (or recompute)
```

**Key distinction - Terminal vs. Internal nodes:**

- **Terminal node**: A ferry endpoint that also connects to regular street edges (featuretyp='0', 'A', 'W'). These MUST remain shared so passengers can board/exit the ferry. Example: Manhattan ferry terminal where ferry meets Peter Minuit Plaza.
- **Internal node**: A ferry endpoint that only connects to other ferry edges and/or bridge/tunnel edges (featuretyp='0' with rw_type='3' bridge or rw_type='4' tunnel). These MUST be isolated because the router can "jump" between ferry and bridge mid-crossing.

### Identifying Terminal vs. Internal Nodes

A node is a **terminal** (should stay shared) if it connects to at least one ground-level street edge that is NOT a bridge or tunnel. A node is **internal** (should be isolated) if every non-ferry edge connected to it is a bridge (rw_type='3') or tunnel (rw_type='4').

```sql
-- Terminal detection: node touches at least one regular street edge
-- (featuretyp in ('0','A','W') AND rw_type NOT IN ('3','4'))
WITH ferry_nodes AS (
    SELECT DISTINCT node_id FROM (
        SELECT source AS node_id FROM edges WHERE featuretyp = 'F'
        UNION
        SELECT target AS node_id FROM edges WHERE featuretyp = 'F'
    ) fn
),
node_edge_types AS (
    SELECT
        fn.node_id,
        bool_or(e.featuretyp != 'F' AND e.rw_type NOT IN ('3', '4')) AS has_street_connection
    FROM ferry_nodes fn
    JOIN edges e ON (e.source = fn.node_id OR e.target = fn.node_id)
    GROUP BY fn.node_id
)
SELECT
    node_id,
    CASE WHEN has_street_connection THEN 'terminal' ELSE 'internal' END AS node_type
FROM node_edge_types;
```

### Anti-Patterns to Avoid

- **Deleting ferry edges then re-inserting:** Destroys edge IDs that may be referenced in cached routes or other tables. Instead, update `source`/`target` in place.
- **Modifying bridge/tunnel edges instead of ferry edges:** Bridge/tunnel routing is well-tested and correct. Only ferry edges need their node references changed.
- **Using pgr_createTopology with tolerance:** pgr_extractVertices (used in this project) does NOT have a tolerance parameter. It matches exact coordinates. Even if tolerance existed, changing it globally would corrupt the entire topology.
- **Reassigning terminal nodes:** Terminal nodes must remain shared so ferry passengers can access the street network. Only internal nodes need isolation.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Vertex ID generation | Manual max(id)+1 loop | PostgreSQL sequence or `COALESCE(MAX(id),0) + ROW_NUMBER()` | Avoids ID collision in concurrent scenarios |
| Geometry duplication | Recreating geometry from scratch | `SELECT geom FROM edges_vertices_pgr WHERE id = old_node_id` | The new vertex must be at the exact same geometry as the old one |
| Edge array maintenance | Manually updating in_edges/out_edges | Recompute from edges table after reassignment | The arrays in edges_vertices_pgr are derived data; recomputing is safer than incremental updates |

**Key insight:** The vertex table (`edges_vertices_pgr`) has `in_edges` and `out_edges` arrays that pgr_extractVertices populates. After reassigning ferry edge source/target, these arrays become stale. The simplest approach is to update them by querying the edges table, or to accept that the routing functions (`pgr_trsp`, `pgr_drivingDistance`) only use `source`/`target` from the edges table and do NOT read `in_edges`/`out_edges` at runtime.

## Common Pitfalls

### Pitfall 1: Breaking the Staten Island Ferry Manual Connection

**What goes wrong:** The manually created SI Ferry edges in `09_ferry_connections.sql` reference specific node IDs (e.g., `st_george_node`, `whitehall_node`). If the isolation step reassigns these nodes, the SI Ferry crossing breaks.

**Why it happens:** The SI Ferry is a manually created edge with hardcoded node references. Its terminal nodes connect to the street network and must NOT be isolated.

**How to avoid:** The SI Ferry edges (created in Step 9) run AFTER the isolation step. OR, if modifying `09_ferry_connections.sql` to include isolation, ensure the manual SI Ferry edges are created after isolation and reference the correct (post-isolation) node IDs. The safest approach: run isolation as a new step BEFORE `09_ferry_connections.sql`, since the SI Ferry manual edges don't exist yet at that point.

**Warning signs:** Walk/bike route from Staten Island fails after the change.

### Pitfall 2: Isolating Terminal Nodes That Should Stay Connected

**What goes wrong:** A ferry terminal node that connects to a regular street is wrongly classified as "internal" and gets a new vertex ID, disconnecting the ferry from the street network.

**Why it happens:** The terminal detection query doesn't account for all street types, or the definition of "bridge/tunnel" is too narrow/broad.

**How to avoid:** Conservative terminal detection: a node is terminal if it connects to ANY non-ferry edge that is not rw_type='3' (bridge) or rw_type='4' (tunnel). Even walkways, alleys, and regular streets count.

**Warning signs:** Ferry edge count stays the same but ferry routes become unreachable (connected component analysis shows new isolated components).

### Pitfall 3: Stale Vertex Accessibility Flags

**What goes wrong:** New vertices created for ferry isolation don't have `has_bikeable`, `has_walkable`, `has_driveable` flags set.

**Why it happens:** `07_vertex_accessibility.sql` runs on all vertices but may have already run before the isolation step.

**How to avoid:** Run the isolation step BEFORE `07_vertex_accessibility.sql` in the pipeline. The current pipeline order supports this: topology is created in `create_topology()`, and vertex accessibility runs later. Insert the isolation step between them.

**Warning signs:** New ferry nodes not showing up in `getnearestbikenode()` or `getnearestwalknode()` results.

### Pitfall 4: Forgetting cached geometry (geom_4326)

**What goes wrong:** New vertices are created but their corresponding edges lack updated `geom_4326` values.

**Why it happens:** The `08_cached_geometries.sql` step already ran before topology creation, and it creates a trigger that maintains `geom_4326` on INSERT/UPDATE of `the_geom`. However, the isolation step only updates `source`/`target`, NOT `the_geom`. So the trigger won't fire.

**How to avoid:** Since we're only changing `source`/`target` references (not geometry), the existing `geom_4326` remains correct. No action needed.

### Pitfall 5: Turn restrictions referencing old nodes

**What goes wrong:** Turn restrictions in the `restrictions` table reference old (shared) node IDs as `via_node`. After isolation, ferry edges use different node IDs, so restrictions become orphaned.

**Why it happens:** `04_restrictions.sql` already excludes ferries (`AND a.featuretyp != 'F' AND b.featuretyp != 'F'`), so ferry edges are never part of turn restrictions.

**How to avoid:** No action needed. The existing restriction generation already excludes ferry edges.

## Code Examples

### Example 1: Identify Shared Ferry-Bridge Nodes

```sql
-- Find nodes shared between ferry edges and bridge/tunnel edges
WITH ferry_nodes AS (
    SELECT DISTINCT node_id FROM (
        SELECT source AS node_id FROM edges WHERE featuretyp = 'F'
        UNION
        SELECT target AS node_id FROM edges WHERE featuretyp = 'F'
    ) sub
),
bridge_tunnel_nodes AS (
    SELECT DISTINCT node_id FROM (
        SELECT source AS node_id FROM edges WHERE rw_type IN ('3', '4')
        UNION
        SELECT target AS node_id FROM edges WHERE rw_type IN ('3', '4')
    ) sub
)
SELECT fn.node_id
FROM ferry_nodes fn
JOIN bridge_tunnel_nodes btn ON fn.node_id = btn.node_id;
```

### Example 2: Create New Vertices for Ferry Internal Nodes

```sql
-- Create new vertex IDs for ferry internal nodes
-- (nodes shared with bridge/tunnel but NOT with regular streets)
WITH ferry_internal_nodes AS (
    -- [query from Architecture Patterns section above]
    SELECT node_id FROM node_edge_types WHERE has_street_connection = FALSE
),
new_vertex_ids AS (
    SELECT
        node_id AS old_id,
        (SELECT MAX(id) FROM edges_vertices_pgr) + ROW_NUMBER() OVER () AS new_id
    FROM ferry_internal_nodes
)
-- Insert new vertices at same geometry
INSERT INTO edges_vertices_pgr (id, geom, x, y)
SELECT
    nv.new_id,
    v.geom,
    v.x,
    v.y
FROM new_vertex_ids nv
JOIN edges_vertices_pgr v ON v.id = nv.old_id;
```

### Example 3: Reassign Ferry Edge Source/Target

```sql
-- Update ferry edges to use new isolated vertices
-- Only update the specific node that was shared (could be source, target, or both)
UPDATE edges e
SET source = nv.new_id
FROM new_vertex_ids nv
WHERE e.featuretyp = 'F'
  AND e.source = nv.old_id;

UPDATE edges e
SET target = nv.new_id
FROM new_vertex_ids nv
WHERE e.featuretyp = 'F'
  AND e.target = nv.old_id;
```

### Example 4: Verification Query

```sql
-- After isolation: verify zero shared internal nodes between ferry and bridge/tunnel
WITH ferry_nodes AS (
    SELECT DISTINCT node_id FROM (
        SELECT source AS node_id FROM edges WHERE featuretyp = 'F'
        UNION
        SELECT target AS node_id FROM edges WHERE featuretyp = 'F'
    ) sub
),
bridge_tunnel_nodes AS (
    SELECT DISTINCT node_id FROM (
        SELECT source AS node_id FROM edges WHERE rw_type IN ('3', '4')
        UNION
        SELECT target AS node_id FROM edges WHERE rw_type IN ('3', '4')
    ) sub
),
shared_nodes AS (
    SELECT fn.node_id
    FROM ferry_nodes fn
    JOIN bridge_tunnel_nodes btn ON fn.node_id = btn.node_id
),
-- Check which shared nodes are terminals (have street connection)
shared_with_classification AS (
    SELECT
        sn.node_id,
        bool_or(e.featuretyp != 'F' AND e.rw_type NOT IN ('3', '4')) AS is_terminal
    FROM shared_nodes sn
    JOIN edges e ON (e.source = sn.node_id OR e.target = sn.node_id)
    GROUP BY sn.node_id
)
SELECT
    COUNT(*) FILTER (WHERE is_terminal = FALSE) AS internal_shared_count,
    COUNT(*) FILTER (WHERE is_terminal = TRUE) AS terminal_shared_count
FROM shared_with_classification;
-- Expected: internal_shared_count = 0 (isolation successful)
-- terminal_shared_count may be > 0 (this is correct - terminals stay shared)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pgr_createTopology (tolerance-based) | pgr_extractVertices (exact coordinate match) | pgRouting 3.4+ | No tolerance parameter; exact matches only |
| Single shared graph | Mode-filtered subgraphs via WHERE clause | Current implementation | Ferry edges participate in bike/walk but not drive subgraph |

**Key observation:** The current codebase already handles graph isolation at query time via `WHERE driveable=TRUE`, `WHERE bikeable=TRUE`, etc. The problem is not query-time filtering but structural: two physically distinct networks (ferry at water level, bridge at elevation) share vertex IDs because their 2D endpoint coordinates happen to coincide.

## Open Questions

1. **How many shared nodes exist?**
   - What we know: The phase description mentions "33 shared with Hugh L. Carey Tunnel, 12 with Verrazzano Bridge"
   - What's unclear: Exact count across all bridges/tunnels; need to run diagnostic queries on live database
   - Recommendation: Run the identification query (Example 1) as the first task to get exact counts before implementing

2. **Are there ferry-to-ferry shared nodes that should also be isolated?**
   - What we know: Some LION ferry routes may share endpoint coordinates with each other
   - What's unclear: Whether ferry-ferry node sharing causes any routing issues
   - Recommendation: Not in scope per requirements; only ferry-bridge/tunnel sharing is the problem

3. **Does the `in_edges`/`out_edges` array on `edges_vertices_pgr` need updating?**
   - What we know: pgr_extractVertices populates these arrays; they become stale after source/target reassignment
   - What's unclear: Whether any downstream code (beyond pgRouting functions themselves) reads these arrays
   - Recommendation: Update them for correctness, but verify that routing functions only use `edges.source`/`edges.target`, not vertex arrays. The create_topology code in `create_network.py` uses these arrays to SET source/target, but that step already completed. Post-isolation, no code reads them. Still, updating them is low-cost and prevents confusion.

4. **Pipeline ordering: new file or modify existing?**
   - What we know: `09_ferry_connections.sql` currently only handles SI Ferry manual connections
   - What's unclear: Whether to add isolation logic to `09_ferry_connections.sql` or create a new file (e.g., `04b_ferry_isolation.sql`)
   - Recommendation: Modify `09_ferry_connections.sql` to include isolation logic BEFORE the SI Ferry manual connections, since the file already owns ferry-related topology work. Rename to reflect broader purpose, or keep name and update header comment. OR: create a separate earlier step to keep concerns separated. The planner should decide based on pipeline clarity.

## Sources

### Primary (HIGH confidence)

- Codebase: `data-importer/src/sql/01_edges.sql` - Edge creation with featuretyp filtering (includes 'F' for ferry)
- Codebase: `data-importer/src/sql/02_travel_time.sql` - Ferry mode flags (bikeable=TRUE, walkable=TRUE, driveable=FALSE)
- Codebase: `data-importer/src/sql/03_cost.sql` - Ferry cost penalties (5x multiplier)
- Codebase: `data-importer/src/sql/04_restrictions.sql` - Turn restrictions exclude ferries (`featuretyp != 'F'`)
- Codebase: `data-importer/src/sql/07_vertex_accessibility.sql` - Vertex has_bikeable/has_walkable flags
- Codebase: `data-importer/src/sql/09_ferry_connections.sql` - Manual SI Ferry terminal connections
- Codebase: `data-importer/src/create_network.py` - Pipeline execution order
- Codebase: `docs/STATEN_ISLAND_CONNECTIVITY_ISSUE.md` - Root cause analysis of ferry connectivity
- pgRouting docs (Context7: /pgrouting/pgrouting) - pgr_extractVertices creates vertices from edge endpoint geometry coordinates

### Secondary (MEDIUM confidence)

- Phase description (from ROADMAP.md) - "33 shared with Hugh L. Carey Tunnel, 12 with Verrazzano Bridge" (needs live DB verification)

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - This is entirely within the existing PostgreSQL/PostGIS/pgRouting stack with no new dependencies
- Architecture: HIGH - The problem and solution are fully understood from codebase analysis; the pipeline integration point is clear
- Pitfalls: HIGH - All edge cases identified from reading existing code; the existing codebase already handles most concerns (restrictions exclude ferries, SI Ferry is manually created, etc.)

**Research date:** 2026-02-14
**Valid until:** Indefinite (SQL topology operations are stable; LION data structure is stable across versions)
