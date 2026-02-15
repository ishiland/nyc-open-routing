import React, { useContext } from "react"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import ToggleButton from "@mui/material/ToggleButton"
import { Directions, Layers } from "@mui/icons-material"
import { IsochroneContext } from "../../contexts/IsochroneContext"
import { AppMode } from "../../types/interfaces"

export const AppModeToggle: React.FC = () => {
  const { appMode, setAppMode } = useContext(IsochroneContext)

  return (
    <ToggleButtonGroup
      value={appMode}
      exclusive
      onChange={(_, newMode: AppMode | null) => newMode && setAppMode(newMode)}
      aria-label="Application mode"
      fullWidth
      size="small"
      sx={{ mb: 1 }}
    >
      <ToggleButton
        value="route"
        aria-label="Route directions"
        sx={{ minHeight: 36, gap: 0.5, textTransform: "none" }}
      >
        <Directions fontSize="small" />
        Route
      </ToggleButton>
      <ToggleButton
        value="isochrone"
        aria-label="Reachability analysis"
        sx={{ minHeight: 36, gap: 0.5, textTransform: "none" }}
      >
        <Layers fontSize="small" />
        Reachability
      </ToggleButton>
    </ToggleButtonGroup>
  )
}
