import React, { useContext } from "react"
import { FormControlLabel, Switch, Box, Typography, Tooltip } from "@mui/material"
import TrafficIcon from "@mui/icons-material/Traffic"
import { RoutingContext } from "../../contexts/RoutingContext"

/**
 * TrafficToggle component
 * Provides a switch to enable/disable traffic-aware routing for driving mode.
 * Only visible when travel mode is "drive".
 */
export function TrafficToggle() {
  const { mode, useTraffic, setUseTraffic } = useContext(RoutingContext)

  // Only show for driving mode
  if (mode !== "drive") {
    return null
  }

  return (
    <Box
      sx={{
        paddingX: 2,
        paddingY: 1,
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
      }}
    >
      <Tooltip title="Include traffic conditions in route calculation" placement="right">
        <FormControlLabel
          control={
            <Switch
              checked={useTraffic}
              onChange={(e) => setUseTraffic(e.target.checked)}
              color="primary"
              size="small"
            />
          }
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TrafficIcon fontSize="small" sx={{ color: "primary.main" }} />
              <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary" }}>
                Use traffic data
              </Typography>
            </Box>
          }
          sx={{ margin: 0 }}
        />
      </Tooltip>
    </Box>
  )
}

export default TrafficToggle
