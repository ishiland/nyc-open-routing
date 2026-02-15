import React, { useContext, useMemo } from "react"
import { Box, Fab, Tooltip, Typography, Paper } from "@mui/material"
import LayersIcon from "@mui/icons-material/Layers"
import { TrafficLayerContext } from "../../contexts/TrafficLayerContext"
import { TRAFFIC_COLOR_STOPS } from "../../utils/style"
import { MAP_CONTROLS_Z_INDEX } from "../../utils/constants"

/**
 * TrafficLayerToggle component
 * Positioned on the map (bottom-left). Includes toggle button, legend, and freshness indicator.
 * Independent of the sidebar TrafficToggle which controls route cost calculation.
 */
export const TrafficLayerToggle: React.FC = () => {
  const { showTrafficLayer, setShowTrafficLayer, lastRefresh } =
    useContext(TrafficLayerContext)

  const freshnessInfo = useMemo(() => {
    if (!lastRefresh) return { text: "No data", color: "text.disabled" }
    const ageMin = Math.round(
      (Date.now() - new Date(lastRefresh).getTime()) / 60000,
    )
    if (ageMin < 5)
      return { text: `Updated ${ageMin} min ago`, color: "success.main" }
    if (ageMin <= 15)
      return { text: `Updated ${ageMin} min ago`, color: "warning.main" }
    return { text: `Updated ${ageMin} min ago`, color: "error.main" }
  }, [lastRefresh])

  return (
    <Box
      sx={{
        position: "absolute",
        bottom: 24,
        left: 24,
        zIndex: MAP_CONTROLS_Z_INDEX,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
      }}
    >
      <Tooltip title="Show traffic conditions on map" placement="right">
        <Fab
          color="default"
          size="small"
          onClick={() => setShowTrafficLayer(!showTrafficLayer)}
          aria-label={
            showTrafficLayer ? "Hide traffic layer" : "Show traffic layer"
          }
          sx={{
            bgcolor: showTrafficLayer ? "primary.main" : "background.paper",
            color: showTrafficLayer ? "primary.contrastText" : "primary.main",
            boxShadow: 2,
            border: "1px solid",
            borderColor: "divider",
            "&:hover": {
              bgcolor: showTrafficLayer ? "primary.dark" : "primary.main",
              color: "primary.contrastText",
            },
            minWidth: 44,
            minHeight: 44,
          }}
        >
          <LayersIcon />
        </Fab>
      </Tooltip>

      {showTrafficLayer && (
        <Paper
          elevation={2}
          sx={{
            mt: 1,
            p: 1.5,
            maxWidth: 160,
          }}
        >
          <Typography
            variant="caption"
            fontWeight={600}
            sx={{ mb: 0.5, display: "block" }}
          >
            Live Traffic
          </Typography>

          {TRAFFIC_COLOR_STOPS.map(stop => (
            <Box
              key={stop.label}
              sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.25 }}
            >
              <Box
                sx={{
                  width: 16,
                  height: 8,
                  bgcolor: stop.color,
                  borderRadius: 0.5,
                  flexShrink: 0,
                }}
              />
              <Typography variant="caption">{stop.label}</Typography>
            </Box>
          ))}

          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 0.75,
              color: freshnessInfo.color,
            }}
          >
            {freshnessInfo.text}
          </Typography>
        </Paper>
      )}
    </Box>
  )
}

export default TrafficLayerToggle
