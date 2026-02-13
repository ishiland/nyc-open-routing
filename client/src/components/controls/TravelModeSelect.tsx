import React, { useContext } from "react"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import ToggleButton from "@mui/material/ToggleButton"
import {
  DirectionsBike,
  DirectionsCar,
  DirectionsWalk,
} from "@mui/icons-material"
import { RoutingContext, TravelMode } from "../../contexts/RoutingContext"
import { MODE_COLORS } from "../../utils/theme"

export const TravelModeSelect: React.FC = () => {
  const { mode, setMode } = useContext(RoutingContext)

  return (
    <ToggleButtonGroup
      value={mode}
      exclusive
      onChange={(_, newMode: TravelMode | null) => newMode && setMode(newMode)}
      aria-label="Travel mode"
      fullWidth
      size="small"
      sx={{
        "& .Mui-selected": {
          bgcolor: MODE_COLORS[mode] + " !important",
          color: "#fff !important",
          "&:hover": {
            bgcolor: MODE_COLORS[mode] + " !important",
            opacity: 0.9,
          },
        },
      }}
    >
      <ToggleButton
        value="drive"
        aria-label="Driving directions"
        sx={{ minHeight: 44, gap: 0.5 }}
      >
        <DirectionsCar fontSize="small" />
        Drive
      </ToggleButton>
      <ToggleButton
        value="bike"
        aria-label="Biking directions"
        sx={{ minHeight: 44, gap: 0.5 }}
      >
        <DirectionsBike fontSize="small" />
        Bike
      </ToggleButton>
      <ToggleButton
        value="walk"
        aria-label="Walking directions"
        sx={{ minHeight: 44, gap: 0.5 }}
      >
        <DirectionsWalk fontSize="small" />
        Walk
      </ToggleButton>
    </ToggleButtonGroup>
  )
}
