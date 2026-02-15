import React, { useContext } from "react"
import { Box, Fab, Tooltip } from "@mui/material"
import { Add, Remove } from "@mui/icons-material"
import { MapInstanceContext } from "../../contexts/MapInstanceContext"
import { MAP_CONTROLS_Z_INDEX } from "../../utils/constants"

/**
 * MapControls component
 * Provides zoom in/out buttons for the map
 * Essential for accessibility (keyboard/screen reader users)
 */
export const MapControls: React.FC = () => {
  const { map } = useContext(MapInstanceContext)
  const isReady = !!map

  const handleZoomIn = () => {
    if (!map) return
    map.zoomIn({ duration: 300 })
  }

  const handleZoomOut = () => {
    if (!map) return
    map.zoomOut({ duration: 300 })
  }

  return (
    <Box
      sx={{
        position: "absolute",
        top: 24,
        right: 24,
        zIndex: MAP_CONTROLS_Z_INDEX,
        display: "flex",
        flexDirection: "column",
        gap: 1,
      }}
    >
      <Tooltip title="Zoom in" placement="left">
        <Fab
          color="default"
          size="small"
          onClick={handleZoomIn}
          disabled={!isReady}
          aria-disabled={!isReady}
          aria-label="Zoom in"
          sx={{
            bgcolor: "background.paper",
            color: "primary.main",
            boxShadow: 2,
            border: "1px solid",
            borderColor: "divider",
            "&:hover": {
              bgcolor: "primary.main",
              color: "primary.contrastText",
            },
            minWidth: 44,
            minHeight: 44,
            opacity: isReady ? 1 : 0.5,
          }}
        >
          <Add />
        </Fab>
      </Tooltip>

      <Tooltip title="Zoom out" placement="left">
        <Fab
          color="default"
          size="small"
          onClick={handleZoomOut}
          disabled={!isReady}
          aria-disabled={!isReady}
          aria-label="Zoom out"
          sx={{
            bgcolor: "background.paper",
            color: "primary.main",
            boxShadow: 2,
            border: "1px solid",
            borderColor: "divider",
            "&:hover": {
              bgcolor: "primary.main",
              color: "primary.contrastText",
            },
            minWidth: 44,
            minHeight: 44,
            opacity: isReady ? 1 : 0.5,
          }}
        >
          <Remove />
        </Fab>
      </Tooltip>
    </Box>
  )
}

export default MapControls
