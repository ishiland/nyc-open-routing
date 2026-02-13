import React, { useContext } from "react"
import { Switch, Box, Typography, Tooltip } from "@mui/material"
import TrafficIcon from "@mui/icons-material/Traffic"
import { RoutingContext } from "../../contexts/RoutingContext"

/**
 * TrafficToggle component
 * Provides a compact inline switch to enable/disable traffic-aware routing for driving mode.
 * Only visible when travel mode is "drive".
 */
export function TrafficToggle() {
  const { mode, useTraffic, setUseTraffic } = useContext(RoutingContext)

  // Only show for driving mode
  if (mode !== "drive") {
    return null
  }

  return (
    <Tooltip title="Include traffic conditions in route calculation" placement="right">
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 2,
          py: 0.5,
        }}
      >
        <Switch
          size="small"
          checked={useTraffic}
          onChange={e => setUseTraffic(e.target.checked)}
          color="primary"
          slotProps={{ input: { "aria-label": "Enable traffic routing" } }}
        />
        <TrafficIcon fontSize="small" sx={{ color: "primary.main" }} />
        <Typography variant="caption" fontWeight={500}>
          Traffic
        </Typography>
      </Box>
    </Tooltip>
  )
}

export default TrafficToggle
