#!/usr/bin/env python3
"""
NYC Open Routing - Network Topology Diagnostic Tool

Analyzes the pgRouting network per travel mode to identify disconnected
subgraphs, isolated vertices, dead-end clusters, and connectivity gaps.
Generates suggested-fix SQL (does NOT auto-apply).

Usage:
    docker compose exec api python3 /scripts/diagnose_topology.py
    docker compose exec api python3 /scripts/diagnose_topology.py --mode drive
    docker compose exec api python3 /scripts/diagnose_topology.py --output /tmp/report.txt
"""

import argparse
import os
import sys
from collections import defaultdict
from datetime import datetime

import psycopg


# Mode configurations: edge filter, cost column, reverse cost, vertex flag
MODE_CONFIG = {
    "drive": {
        "filter": "driveable=TRUE",
        "cost": "cost_drive",
        "rcost": "rcost_drive",
        "flag": "has_driveable",
        "label": "DRIVE",
    },
    "bike": {
        "filter": "bikeable=TRUE",
        "cost": "cost_bike",
        "rcost": "rcost_bike",
        "flag": "has_bikeable",
        "label": "BIKE",
    },
    "walk": {
        "filter": "walkable=TRUE",
        "cost": "cost_walk",
        "rcost": "rcost_walk",
        "flag": "has_walkable",
        "label": "WALK",
    },
}

# Known borough reference points (lon, lat) for connectivity tests
BOROUGH_COORDS = {
    "Manhattan": (-73.9712, 40.7831),
    "Brooklyn": (-73.9442, 40.6782),
    "Queens": (-73.7949, 40.7282),
    "Bronx": (-73.8648, 40.8448),
    "Staten Island": (-74.1502, 40.5795),
}


def validate_environment():
    """Validate required environment variables and return connection params."""
    required_vars = ["POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB", "POSTGRES_HOST"]
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        print(
            f"ERROR: Missing required environment variables: {', '.join(missing)}",
            file=sys.stderr,
        )
        sys.exit(1)
    return {
        "user": os.getenv("POSTGRES_USER"),
        "password": os.getenv("POSTGRES_PASSWORD"),
        "dbname": os.getenv("POSTGRES_DB"),
        "host": os.getenv("POSTGRES_HOST"),
        "port": os.getenv("POSTGRES_PORT", "5432"),
        "connect_timeout": 60,
    }


def log(msg, verbose_only=False, verbose=False):
    if verbose_only and not verbose:
        return
    print(f"  {msg}", flush=True)


def compute_components(cur, mode_cfg, verbose=False):
    """Compute connected components and store in temp table for reuse."""
    log("Computing connected components...", verbose_only=True, verbose=verbose)
    cur.execute("DROP TABLE IF EXISTS _topo_components")
    cur.execute(
        f"""
        CREATE TEMP TABLE _topo_components AS
        SELECT node, component
        FROM pgr_connectedComponents(
            'SELECT id, source, target, {mode_cfg["cost"]} AS cost
             FROM edges WHERE {mode_cfg["filter"]}'
        )
    """
    )
    cur.execute("CREATE INDEX ON _topo_components (node)")
    cur.execute("CREATE INDEX ON _topo_components (component)")


def get_connected_components(cur, verbose=False):
    """Stage 1: Analyze connected components from pre-computed temp table."""
    log("Analyzing connected components...", verbose_only=True, verbose=verbose)
    cur.execute("""
        SELECT component, COUNT(*) as node_count
        FROM _topo_components
        GROUP BY component
        ORDER BY node_count DESC
    """)
    rows = cur.fetchall()

    if not rows:
        return {"total": 0, "main_component": None, "main_size": 0, "isolated": []}

    main_component = rows[0][0]
    main_size = rows[0][1]
    total_nodes = sum(r[1] for r in rows)
    isolated = [(r[0], r[1]) for r in rows[1:]]

    return {
        "total": len(rows),
        "main_component": main_component,
        "main_size": main_size,
        "total_nodes": total_nodes,
        "pct_main": round(100.0 * main_size / total_nodes, 1) if total_nodes else 0,
        "isolated": isolated,
    }


def get_isolated_vertices(cur, mode_cfg, verbose=False):
    """Stage 2: Find vertices flagged for a mode but with no connected edges."""
    log("Finding isolated vertices...", verbose_only=True, verbose=verbose)
    flag = mode_cfg["flag"]
    filt = mode_cfg["filter"]
    query = f"""
        SELECT v.id,
               ST_X(ST_Transform(v.geom, 4326)) AS lon,
               ST_Y(ST_Transform(v.geom, 4326)) AS lat
        FROM edges_vertices_pgr v
        WHERE v.{flag} = TRUE
          AND NOT EXISTS (
              SELECT 1 FROM edges e
              WHERE (e.source = v.id OR e.target = v.id)
                AND e.{filt}
          )
        ORDER BY v.id
    """
    cur.execute(query)
    return cur.fetchall()


def get_dead_end_clusters(cur, mode_cfg, max_gap_feet, verbose=False):
    """Stage 3: Find degree-1 vertices that cluster together."""
    log("Detecting dead-end clusters...", verbose_only=True, verbose=verbose)
    filt = mode_cfg["filter"]
    query = f"""
        WITH degree_one AS (
            SELECT v.id, v.geom,
                   ST_X(ST_Transform(v.geom, 4326)) AS lon,
                   ST_Y(ST_Transform(v.geom, 4326)) AS lat
            FROM edges_vertices_pgr v
            WHERE (
                SELECT COUNT(*) FROM edges e
                WHERE (e.source = v.id OR e.target = v.id)
                  AND e.{filt}
            ) = 1
        )
        SELECT id, lon, lat FROM degree_one ORDER BY id
    """
    cur.execute(query)
    dead_ends = cur.fetchall()

    if not dead_ends:
        return {"total_dead_ends": 0, "clusters": []}

    # Cluster nearby dead-ends using simple distance grouping
    # Use the DB for spatial proximity
    query_clusters = f"""
        WITH degree_one AS (
            SELECT v.id, v.geom
            FROM edges_vertices_pgr v
            WHERE (
                SELECT COUNT(*) FROM edges e
                WHERE (e.source = v.id OR e.target = v.id)
                  AND e.{filt}
            ) = 1
        ),
        pairs AS (
            SELECT a.id AS id_a, b.id AS id_b,
                   ST_Distance(a.geom, b.geom) AS dist
            FROM degree_one a, degree_one b
            WHERE a.id < b.id
              AND ST_DWithin(a.geom, b.geom, {max_gap_feet})
        )
        SELECT id_a, id_b, dist FROM pairs ORDER BY dist
    """
    cur.execute(query_clusters)
    pairs = cur.fetchall()

    # Build clusters via union-find
    parent = {}

    def find(x):
        while parent.get(x, x) != x:
            parent[x] = parent.get(parent[x], parent[x])
            x = parent[x]
        return x

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for id_a, id_b, _ in pairs:
        union(id_a, id_b)

    clusters = defaultdict(set)
    for id_a, id_b, _ in pairs:
        clusters[find(id_a)].add(id_a)
        clusters[find(id_a)].add(id_b)

    # Filter to clusters of 3+
    significant = {k: v for k, v in clusters.items() if len(v) >= 3}

    # Get coordinates for each cluster
    cluster_info = []
    for root, members in sorted(significant.items(), key=lambda x: -len(x[1])):
        member_ids = ",".join(str(m) for m in members)
        cur.execute(
            f"""
            SELECT AVG(ST_X(ST_Transform(geom, 4326))),
                   AVG(ST_Y(ST_Transform(geom, 4326)))
            FROM edges_vertices_pgr WHERE id IN ({member_ids})
        """
        )
        center = cur.fetchone()
        cluster_info.append(
            {"size": len(members), "members": members, "center_lon": center[0], "center_lat": center[1]}
        )

    return {"total_dead_ends": len(dead_ends), "clusters": cluster_info}


def get_connectivity_gaps(cur, components, max_gap_feet, verbose=False):
    """Stage 4: Find geographic gaps between disconnected components.

    Uses pre-computed _topo_components temp table.
    """
    if components["total"] <= 1:
        return []

    log("Detecting connectivity gaps...", verbose_only=True, verbose=verbose)
    main_comp = components["main_component"]

    # For each small component, find its closest node to the main component
    # Process one component at a time to avoid massive cross joins
    gaps = []
    for comp_id, comp_size in components["isolated"]:
        query = f"""
            WITH small_boundary AS (
                SELECT cn.node, v.geom
                FROM _topo_components cn
                JOIN edges_vertices_pgr v ON cn.node = v.id
                WHERE cn.component = {comp_id}
            ),
            nearest AS (
                SELECT sb.node AS small_node, sb.geom AS small_geom,
                       (SELECT v2.id FROM edges_vertices_pgr v2
                        JOIN _topo_components mn
                        ON mn.node = v2.id AND mn.component = {main_comp}
                        ORDER BY v2.geom <-> sb.geom LIMIT 1) AS main_node
                FROM small_boundary sb
            )
            SELECT n.small_node,
                   n.main_node,
                   ST_Distance(n.small_geom, m.geom) AS gap_feet,
                   ST_X(ST_Transform(n.small_geom, 4326)) AS small_lon,
                   ST_Y(ST_Transform(n.small_geom, 4326)) AS small_lat,
                   ST_X(ST_Transform(m.geom, 4326)) AS main_lon,
                   ST_Y(ST_Transform(m.geom, 4326)) AS main_lat
            FROM nearest n
            JOIN edges_vertices_pgr m ON m.id = n.main_node
            ORDER BY gap_feet
            LIMIT 1
        """
        try:
            cur.execute(query)
            row = cur.fetchone()
            if row:
                gaps.append(
                    {
                        "component": comp_id,
                        "comp_size": comp_size,
                        "small_node": row[0],
                        "main_node": row[1],
                        "gap_feet": round(row[2], 1),
                        "small_lon": round(row[3], 6),
                        "small_lat": round(row[4], 6),
                        "main_lon": round(row[5], 6),
                        "main_lat": round(row[6], 6),
                        "bridgeable": row[2] <= max_gap_feet,
                    }
                )
        except Exception as e:
            log(f"  Warning: Could not analyze component {comp_id}: {e}")

    return sorted(gaps, key=lambda g: g["gap_feet"])


def test_borough_connectivity(cur, mode_cfg, verbose=False):
    """Stage 5: Test if each borough can reach every other borough.

    Uses pre-computed _topo_components temp table.
    """
    log("Testing borough connectivity...", verbose_only=True, verbose=verbose)
    flag = mode_cfg["flag"]

    # First, get the nearest node for each borough
    borough_nodes = {}
    for borough, (lon, lat) in BOROUGH_COORDS.items():
        cur.execute(
            f"""
            SELECT id FROM edges_vertices_pgr
            WHERE {flag} = TRUE
            ORDER BY geom <-> ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 2263)
            LIMIT 1
        """,
            (lon, lat),
        )
        row = cur.fetchone()
        if row:
            borough_nodes[borough] = row[0]

    if not borough_nodes:
        return {}

    # Get each borough node's component from pre-computed table
    node_ids = ",".join(str(v) for v in borough_nodes.values())
    cur.execute(
        f"SELECT node, component FROM _topo_components WHERE node IN ({node_ids})"
    )
    node_components = dict(cur.fetchall())

    results = {}
    for borough, node_id in borough_nodes.items():
        comp = node_components.get(node_id)
        results[borough] = {
            "node_id": node_id,
            "component": comp,
        }

    # Check which boroughs share a component (can reach each other)
    main_comp = None
    comp_counts = defaultdict(int)
    for info in results.values():
        if info["component"] is not None:
            comp_counts[info["component"]] += 1
    if comp_counts:
        main_comp = max(comp_counts, key=comp_counts.get)

    for borough, info in results.items():
        info["connected_to_main"] = info["component"] == main_comp

    return results


def generate_fix_sql(mode, mode_cfg, isolated_verts, components, gaps):
    """Generate suggested fix SQL for identified problems.

    Cost model (from 02_travel_time.sql + 03_cost.sql):
      time_drive = (length_feet / 5280) / (posted_speed * factor / 60)  [minutes]
      time_bike  = (length_feet / 5280) / 0.2                          [minutes, 12 mph]
      time_walk  = (length_feet / 5280) / 0.05                         [minutes, 3 mph]
      cost_drive = time_drive (bidirectional)
      cost_bike  = time_bike * multiplier  (3.0 for no-bike-lane bidirectional)
      cost_walk  = time_walk * 1.0 (normal pedestrian)

    Bridge edges use nextval('edges_id_seq') to avoid sequence desync.
    Includes length_feet for API distance responses.
    Includes idempotency guard (NOT EXISTS check on source/target pair).
    Includes vertex accessibility flag updates after bridge creation.
    """
    fixes = []
    filt = mode_cfg["filter"]
    cost = mode_cfg["cost"]
    flag = mode_cfg["flag"]
    mode_label = mode_cfg["label"].lower()

    # Fix 1: Clear stale vertex flags for orphan vertices
    if isolated_verts:
        ids = ", ".join(str(v[0]) for v in isolated_verts)
        fixes.append(
            f"-- Fix: Clear {len(isolated_verts)} orphan vertex flags ({mode} mode)\n"
            f"-- These vertices have {flag}=TRUE but no connected {mode_label}able edges\n"
            f"UPDATE edges_vertices_pgr SET {flag} = FALSE WHERE id IN ({ids});"
        )

    # Fix 2: Bridge gaps between components
    bridgeable = [g for g in gaps if g["bridgeable"]]
    bridge_node_pairs = []  # track for vertex flag updates at end
    for g in bridgeable:
        gap_feet = g["gap_feet"]
        # Use max(1, gap_feet) to avoid zero-length issues for 0ft gaps
        eff_feet = max(1.0, gap_feet)

        # Time calculations matching 02_travel_time.sql formulas
        dist_miles = eff_feet / 5280.0
        time_drive = round(dist_miles / (25 * 0.80 / 60.0), 4)  # 25mph, 80% factor, 2-lane
        time_bike = round(dist_miles / 0.2, 4)   # 12 mph = 0.2 mi/min
        time_walk = round(dist_miles / 0.05, 4)   # 3 mph = 0.05 mi/min

        # Cost calculations matching 03_cost.sql
        # Drive: bidirectional = time_drive
        # Bike: no bike lane, bidirectional = time_bike * 3.0
        # Walk: normal = time_walk * 1.0
        if mode == "drive":
            driveable, bikeable, walkable = "TRUE", "FALSE", "TRUE"
            cost_drive = round(time_drive, 4)
            rcost_drive = round(time_drive, 4)
            cost_bike = 999999
            rcost_bike = 999999
            cost_walk = round(time_walk, 4)
            rcost_walk = round(time_walk, 4)
        else:
            # bike and walk gaps get bikeable+walkable bridges
            driveable, bikeable, walkable = "FALSE", "TRUE", "TRUE"
            cost_drive = 999999
            rcost_drive = 999999
            cost_bike = round(time_bike * 3.0, 4)  # no bike lane bidirectional
            rcost_bike = round(time_bike * 3.0, 4)
            cost_walk = round(time_walk, 4)
            rcost_walk = round(time_walk, 4)

        sn, mn = g["small_node"], g["main_node"]
        bridge_node_pairs.append((sn, mn))

        fixes.append(
            f"-- Fix: Bridge {gap_feet}ft gap between component {g['component']} "
            f"({g['comp_size']} nodes) and main component\n"
            f"-- Gap: ({g['small_lon']}, {g['small_lat']}) -> ({g['main_lon']}, {g['main_lat']})\n"
            f"INSERT INTO edges (\n"
            f"    id, source, target, street, featuretyp, rw_type,\n"
            f"    driveable, bikeable, walkable, length_feet,\n"
            f"    the_geom, geom_4326,\n"
            f"    cost_drive, cost_bike, cost_walk,\n"
            f"    rcost_drive, rcost_bike, rcost_walk,\n"
            f"    time_drive, time_bike, time_walk,\n"
            f"    traffic_factor\n"
            f")\n"
            f"SELECT\n"
            f"    nextval('edges_id_seq'),\n"
            f"    {sn}, {mn},\n"
            f"    'TOPOLOGY FIX BRIDGE', '0', '1',\n"
            f"    {driveable}, {bikeable}, {walkable}, {round(eff_feet, 1)},\n"
            f"    ST_MakeLine(\n"
            f"        (SELECT geom FROM edges_vertices_pgr WHERE id = {sn}),\n"
            f"        (SELECT geom FROM edges_vertices_pgr WHERE id = {mn})\n"
            f"    ),\n"
            f"    ST_Transform(ST_MakeLine(\n"
            f"        (SELECT geom FROM edges_vertices_pgr WHERE id = {sn}),\n"
            f"        (SELECT geom FROM edges_vertices_pgr WHERE id = {mn})\n"
            f"    ), 4326),\n"
            f"    {cost_drive}, {cost_bike}, {cost_walk},\n"
            f"    {rcost_drive}, {rcost_bike}, {rcost_walk},\n"
            f"    {round(time_drive, 4)}, {round(time_bike, 4)}, {round(time_walk, 4)},\n"
            f"    1.0\n"
            f"FROM edges\n"
            f"WHERE NOT EXISTS (\n"
            f"    SELECT 1 FROM edges\n"
            f"    WHERE source = {sn} AND target = {mn}\n"
            f"       OR source = {mn} AND target = {sn}\n"
            f")\n"
            f"LIMIT 1;  -- only need one row to drive the SELECT"
        )

    # Fix 3: Disable mode flag on tiny isolated components (< 5 nodes)
    # Uses UPDATE instead of DELETE to avoid destroying multi-modal edges
    tiny_comps = [c for c in components["isolated"] if c[1] < 5]
    if tiny_comps:
        comp_ids = ", ".join(str(c[0]) for c in tiny_comps)
        total_nodes = sum(c[1] for c in tiny_comps)
        fixes.append(
            f"-- Fix: Disable {mode} mode on {len(tiny_comps)} tiny isolated components "
            f"({total_nodes} nodes total, each <5 nodes)\n"
            f"-- Uses UPDATE (not DELETE) to preserve edges used by other modes\n"
            f"-- Step 1: Disable mode flag on affected edges\n"
            f"WITH tiny_nodes AS (\n"
            f"    SELECT node FROM pgr_connectedComponents(\n"
            f"        'SELECT id, source, target, {cost} AS cost\n"
            f"         FROM edges WHERE {filt}'\n"
            f"    ) WHERE component IN ({comp_ids})\n"
            f")\n"
            f"UPDATE edges\n"
            f"SET {mode_label}able = FALSE\n"
            f"WHERE {filt}\n"
            f"  AND source IN (SELECT node FROM tiny_nodes)\n"
            f"  AND target IN (SELECT node FROM tiny_nodes);\n"
            f"\n"
            f"-- Step 2: Update vertex accessibility flags\n"
            f"UPDATE edges_vertices_pgr v\n"
            f"SET {flag} = EXISTS (\n"
            f"    SELECT 1 FROM edges e\n"
            f"    WHERE (e.source = v.id OR e.target = v.id)\n"
            f"      AND e.{filt}\n"
            f")\n"
            f"WHERE v.{flag} = TRUE;"
        )

    # Fix 4: Update vertex accessibility flags for bridge endpoints
    if bridge_node_pairs:
        all_nodes = set()
        for sn, mn in bridge_node_pairs:
            all_nodes.add(sn)
            all_nodes.add(mn)
        node_ids = ", ".join(str(n) for n in sorted(all_nodes))

        # Determine which flags to update based on mode
        if mode == "drive":
            flag_updates = (
                f"    has_driveable = EXISTS (\n"
                f"        SELECT 1 FROM edges e\n"
                f"        WHERE (e.source = v.id OR e.target = v.id) AND e.driveable = TRUE\n"
                f"    ),\n"
                f"    has_walkable = EXISTS (\n"
                f"        SELECT 1 FROM edges e\n"
                f"        WHERE (e.source = v.id OR e.target = v.id) AND e.walkable = TRUE\n"
                f"    )"
            )
        else:
            flag_updates = (
                f"    has_bikeable = EXISTS (\n"
                f"        SELECT 1 FROM edges e\n"
                f"        WHERE (e.source = v.id OR e.target = v.id) AND e.bikeable = TRUE\n"
                f"    ),\n"
                f"    has_walkable = EXISTS (\n"
                f"        SELECT 1 FROM edges e\n"
                f"        WHERE (e.source = v.id OR e.target = v.id) AND e.walkable = TRUE\n"
                f"    )"
            )

        fixes.append(
            f"-- Fix: Update vertex accessibility flags for {len(all_nodes)} bridge endpoints\n"
            f"-- Required for getnearestXXXnode() functions to find these vertices\n"
            f"UPDATE edges_vertices_pgr v\n"
            f"SET\n"
            f"{flag_updates}\n"
            f"WHERE v.id IN ({node_ids});"
        )

    return fixes


def format_report(mode, mode_cfg, components, isolated_verts, dead_ends, gaps, borough):
    """Format the report section for a single mode."""
    lines = []
    label = mode_cfg["label"]
    lines.append(f"\n=== {label} MODE ===\n")

    # Components
    lines.append("Connected Components:")
    if components["total"] == 0:
        lines.append("  No edges found for this mode")
    else:
        lines.append(f"  Total: {components['total']}")
        lines.append(
            f"  Main component: {components['main_size']:,} nodes ({components['pct_main']}%)"
        )
        iso_nodes = sum(c[1] for c in components["isolated"])
        lines.append(
            f"  Isolated: {len(components['isolated'])} component(s) ({iso_nodes:,} nodes total)"
        )
        if components["isolated"]:
            for comp_id, size in components["isolated"][:10]:
                lines.append(f"    Component {comp_id}: {size} nodes")
            if len(components["isolated"]) > 10:
                lines.append(f"    ... and {len(components['isolated']) - 10} more")

    # Isolated vertices
    lines.append(f"\nIsolated Vertices: {len(isolated_verts)} orphan nodes")
    if isolated_verts:
        for vid, lon, lat in isolated_verts[:10]:
            lines.append(f"  Node {vid}: ({lon:.6f}, {lat:.6f})")
        if len(isolated_verts) > 10:
            lines.append(f"  ... and {len(isolated_verts) - 10} more")

    # Dead-end clusters
    lines.append(
        f"\nDead-End Analysis: {dead_ends['total_dead_ends']} degree-1 vertices, "
        f"{len(dead_ends['clusters'])} clusters of 3+ nearby"
    )
    for cluster in dead_ends["clusters"][:10]:
        lines.append(
            f"  Cluster ({cluster['size']} dead-ends) near "
            f"({cluster['center_lon']:.6f}, {cluster['center_lat']:.6f})"
        )
    if len(dead_ends["clusters"]) > 10:
        lines.append(f"  ... and {len(dead_ends['clusters']) - 10} more")

    # Gaps
    bridgeable = [g for g in gaps if g["bridgeable"]]
    far = [g for g in gaps if not g["bridgeable"]]
    lines.append(
        f"\nConnectivity Gaps: {len(bridgeable)} bridgeable, {len(far)} too far"
    )
    for g in gaps[:10]:
        marker = "BRIDGEABLE" if g["bridgeable"] else "too far"
        lines.append(
            f"  Component {g['component']} ({g['comp_size']} nodes) -> Main: "
            f"{g['gap_feet']}ft [{marker}] at ({g['small_lon']}, {g['small_lat']})"
        )
    if len(gaps) > 10:
        lines.append(f"  ... and {len(gaps) - 10} more")

    # Borough connectivity
    lines.append("\nBorough Connectivity:")
    for bname, info in borough.items():
        status = "OK" if info["connected_to_main"] else "DISCONNECTED"
        lines.append(f"  {bname}: {status} (node {info['node_id']}, component {info['component']})")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="NYC Open Routing - Network Topology Diagnostic Tool"
    )
    parser.add_argument(
        "--mode",
        choices=["drive", "bike", "walk", "all"],
        default="all",
        help="Which mode(s) to analyze (default: all)",
    )
    parser.add_argument(
        "--output",
        type=str,
        default=None,
        help="Write report to file (default: stdout)",
    )
    parser.add_argument(
        "--max-gap-feet",
        type=int,
        default=500,
        help="Max gap distance for bridge suggestions (default: 500)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show progress and debug info",
    )
    args = parser.parse_args()

    modes = ["drive", "bike", "walk"] if args.mode == "all" else [args.mode]

    # Connect to database
    connect_params = validate_environment()
    try:
        conn = psycopg.connect(**connect_params)
    except Exception as e:
        print(f"ERROR: Could not connect to database: {e}", file=sys.stderr)
        sys.exit(1)

    # Pre-flight: check required tables exist
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) FROM information_schema.tables
            WHERE table_name IN ('edges', 'edges_vertices_pgr')
              AND table_schema = 'public'
        """)
        table_count = cur.fetchone()[0]
        if table_count < 2:
            print(
                "ERROR: Required tables (edges, edges_vertices_pgr) not found.\n"
                "Run the LION data import first:\n"
                "  docker compose exec api sh /data-imports/import-lion.sh 25a",
                file=sys.stderr,
            )
            conn.close()
            sys.exit(1)

    output_lines = []
    all_fixes = []

    output_lines.append("=" * 80)
    output_lines.append("NYC Open Routing - Network Topology Diagnostic Report")
    output_lines.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    output_lines.append("=" * 80)

    # Track component signatures to detect duplicate bike/walk networks
    prev_component_sig = None
    with conn.cursor() as cur:
        for mode in modes:
            cfg = MODE_CONFIG[mode]
            print(f"\nAnalyzing {cfg['label']} mode...", flush=True)

            # Pre-compute components into temp table (reused by stages 1, 4, 5)
            compute_components(cur, cfg, args.verbose)

            # Stage 1: Connected components
            components = get_connected_components(cur, args.verbose)

            # Stage 2: Isolated vertices
            isolated = get_isolated_vertices(cur, cfg, args.verbose)

            # Stage 3: Dead-end clusters
            dead_ends = get_dead_end_clusters(cur, cfg, args.max_gap_feet, args.verbose)

            # Stage 4: Gap detection
            gaps = get_connectivity_gaps(
                cur, components, args.max_gap_feet, args.verbose
            )

            # Stage 5: Borough connectivity
            borough = test_borough_connectivity(cur, cfg, args.verbose)

            # Format report section
            section = format_report(mode, cfg, components, isolated, dead_ends, gaps, borough)
            output_lines.append(section)

            # Generate fix SQL — deduplicate if this mode has identical
            # components to the previous mode (e.g., bike and walk are often identical)
            component_sig = (components["total"], components["main_size"], len(gaps))
            if component_sig == prev_component_sig:
                output_lines.append(
                    f"  (Fix SQL skipped — identical topology to previous mode, "
                    f"bridges already cover both)"
                )
            else:
                fixes = generate_fix_sql(mode, cfg, isolated, components, gaps)
                if fixes:
                    all_fixes.append((mode, fixes))
            prev_component_sig = component_sig

    # Suggested fixes section
    if all_fixes:
        output_lines.append("\n" + "=" * 80)
        output_lines.append("SUGGESTED FIXES (review before applying)")
        output_lines.append("=" * 80)
        for mode, fixes in all_fixes:
            output_lines.append(f"\n-- === {mode.upper()} MODE FIXES ===\n")
            for fix in fixes:
                output_lines.append(fix)
                output_lines.append("")
    else:
        output_lines.append("\n" + "=" * 80)
        output_lines.append("No fixes suggested - network looks healthy!")
        output_lines.append("=" * 80)

    conn.close()

    # Output
    report = "\n".join(output_lines) + "\n"
    if args.output:
        with open(args.output, "w") as f:
            f.write(report)
        print(f"\nReport written to {args.output}")
    else:
        print(report)


if __name__ == "__main__":
    main()
