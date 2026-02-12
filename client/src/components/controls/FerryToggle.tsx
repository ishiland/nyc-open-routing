import React, { useContext } from "react"
import { FormControlLabel, Switch, Box, Typography, Tooltip } from "@mui/material"
import DirectionsBoatIcon from "@mui/icons-material/DirectionsBoat"
import { RoutingContext } from "../../contexts/RoutingContext"

/**
 * FerryToggle component
 * Provides a switch to enable/disable ferry avoidance for bike/walk modes.
 * Only visible when travel mode is "bike" or "walk".
 */
export function FerryToggle() {
  const { mode, avoidFerries, setAvoidFerries } = useContext(RoutingContext)

  // Only show for bike and walk modes
  if (mode === "drive") {
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
      <Tooltip title="Exclude ferry crossings from route" placement="right">
        <FormControlLabel
          control={
            <Switch
              checked={avoidFerries}
              onChange={(e) => setAvoidFerries(e.target.checked)}
              color="primary"
              size="small"
            />
          }
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <DirectionsBoatIcon fontSize="small" sx={{ color: "primary.main" }} />
              <Typography variant="body2" sx={{ fontWeight: 500, color: "text.primary" }}>
                Avoid ferries
              </Typography>
            </Box>
          }
          sx={{ margin: 0 }}
        />
      </Tooltip>
    </Box>
  )
}

export default FerryToggle
