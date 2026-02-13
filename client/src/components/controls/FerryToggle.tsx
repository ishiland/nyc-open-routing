import React, { useContext } from "react"
import { Switch, Box, Typography, Tooltip } from "@mui/material"
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat"
import { RoutingContext } from "../../contexts/RoutingContext"

/**
 * FerryToggle component
 * Provides a compact inline switch to enable/disable ferry avoidance for bike/walk modes.
 * Only visible when travel mode is "bike" or "walk".
 */
export function FerryToggle() {
  const { mode, avoidFerries, setAvoidFerries } = useContext(RoutingContext)

  // Only show for bike and walk modes
  if (mode === "drive") {
    return null
  }

  return (
    <Tooltip title="Exclude ferry crossings from route" placement="right">
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
          checked={avoidFerries}
          onChange={e => setAvoidFerries(e.target.checked)}
          color="primary"
        />
        <DirectionsBoatIcon fontSize="small" sx={{ color: "primary.main" }} />
        <Typography variant="caption" fontWeight={500}>
          Avoid ferries
        </Typography>
      </Box>
    </Tooltip>
  )
}

export default FerryToggle
