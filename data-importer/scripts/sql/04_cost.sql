---------------------------------------------
-- Helper Indexes for updates -- REMOVED as columns are no longer present or needed for MVP cost logic
---------------------------------------------
-- CREATE INDEX IF NOT EXISTS idx_edges_one_way ON edges (one_way); -- REMOVED
-- CREATE INDEX IF NOT EXISTS idx_edges_trafdir ON edges (trafdir); -- REMOVED (trafdir still exists, but not used in this simplified cost logic directly for indexing)
-- CREATE INDEX IF NOT EXISTS idx_edges_one_way_bike ON edges (one_way_bike); -- REMOVED
-- CREATE INDEX IF NOT EXISTS idx_edges_bike_trafdir_nullable ON edges (bike_trafdir); -- REMOVED
-- CREATE INDEX IF NOT EXISTS idx_edges_bikelane_nullable ON edges (bikelane); -- REMOVED

---------------------------------------------
--              Consolidated Costs Update
---------------------------------------------
UPDATE edges
SET
    cost_drive = CASE WHEN driveable = TRUE THEN time_drive ELSE NULL END,
    rcost_drive = CASE WHEN driveable = TRUE THEN time_drive ELSE NULL END, -- MVP: rcost = cost
    cost_bike = CASE WHEN bikeable = TRUE THEN time_bike ELSE NULL END,
    rcost_bike = CASE WHEN bikeable = TRUE THEN time_bike ELSE NULL END, -- MVP: rcost = cost
    cost_walk = CASE WHEN walkable = TRUE THEN time_walk ELSE NULL END,
    rcost_walk = CASE WHEN walkable = TRUE THEN time_walk ELSE NULL END; -- MVP: rcost = cost

-- Separate update for walk costs to ensure all walkable edges get costs -- REMOVED as it's consolidated above
-- regardless of whether they're bikeable or not -- REMOVED
-- UPDATE edges -- REMOVED
-- SET -- REMOVED
--     cost_walk = time_walk, -- REMOVED
--     rcost_walk = time_walk -- REMOVED
-- WHERE walkable = TRUE; -- REMOVED

----------------------------------------------
-- Multi-column indexes for filtering
----------------------------------------------
CREATE INDEX IF NOT EXISTS idx_edges_driveable_cost ON edges (driveable, cost_drive);
CREATE INDEX IF NOT EXISTS idx_edges_bikeable_cost ON edges (bikeable, cost_bike);
CREATE INDEX IF NOT EXISTS idx_edges_walkable_cost ON edges (walkable, cost_walk);

-- It might also be beneficial to have indexes for reverse costs if queries use them similarly
CREATE INDEX IF NOT EXISTS idx_edges_driveable_rcost ON edges (driveable, rcost_drive);
CREATE INDEX IF NOT EXISTS idx_edges_bikeable_rcost ON edges (bikeable, rcost_bike);
CREATE INDEX IF NOT EXISTS idx_edges_walkable_rcost ON edges (walkable, rcost_walk);

-- Cost indexes
CREATE INDEX IF NOT EXISTS idx_edges_cost_drive ON edges(cost_drive);
CREATE INDEX IF NOT EXISTS idx_edges_cost_bike ON edges(cost_bike);
CREATE INDEX IF NOT EXISTS idx_edges_cost_walk ON edges(cost_walk); 