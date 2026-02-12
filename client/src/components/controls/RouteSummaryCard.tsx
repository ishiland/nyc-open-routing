import React, { useContext, useMemo } from "react"
import { Card, CardContent, Typography, Box, Chip } from "@mui/material"
import {
  DirectionsCar,
  DirectionsBike,
  DirectionsWalk,
  AccessTime,
  Straighten,
  Traffic as TrafficIcon,
} from "@mui/icons-material"
import { RoutingContext } from "../../contexts/RoutingContext"
import {
  formatTotalRouteDistance,
  formatTotalRouteTime,
  formatArrivalTime,
} from "../../utils/formats"

/**
 * RouteSummaryCard component
 * Displays a prominent summary of the calculated route including:
 * - Travel mode icon and label
 * - Total distance
 * - Total duration
 * - Estimated arrival time
 * - Traffic status (for driving mode)
 */
export const RouteSummaryCard: React.FC = () => {
  const { route, mode, useTraffic } = useContext(RoutingContext)

  // Memoize expensive calculations
  const { totalDistance, totalTime, arrivalTime } = useMemo(() => {
    if (!route?.features?.length) {
      return { totalDistance: "", totalTime: "", arrivalTime: "" }
    }
    return {
      totalDistance: formatTotalRouteDistance(route.features),
      totalTime: formatTotalRouteTime(route.features),
      arrivalTime: formatArrivalTime(route.features),
    }
  }, [route?.features])

  // Don't render if no route
  if (!route?.features?.length) {
    return null
  }

  // Get mode icon and label
  const getModeIcon = () => {
    switch (mode) {
      case "drive":
        return <DirectionsCar fontSize="large" />
      case "bike":
        return <DirectionsBike fontSize="large" />
      case "walk":
        return <DirectionsWalk fontSize="large" />
    }
  }

  const getModeLabel = () => {
    switch (mode) {
      case "drive":
        return "Driving"
      case "bike":
        return "Biking"
      case "walk":
        return "Walking"
    }
  }

  return (
    <Card
      sx={{
        width: "100%",
        mb: 2,
        borderLeft: 4,
        borderColor: "primary.main",
        boxShadow: 2,
      }}
      elevation={3}
    >
      <CardContent>
        {/* Mode Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            mb: 2,
          }}
        >
          <Box sx={{ color: "primary.main", display: "flex", alignItems: "center" }}>
            {getModeIcon()}
          </Box>
          <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
            {getModeLabel()} Route
          </Typography>
          {mode === "drive" && useTraffic && (
            <Chip
              icon={<TrafficIcon fontSize="small" />}
              label="Traffic"
              size="small"
              color="primary"
              variant="outlined"
              sx={{ ml: "auto" }}
            />
          )}
        </Box>

        {/* Route Statistics */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 2,
          }}
        >
          {/* Distance */}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
              <Straighten fontSize="small" sx={{ color: "text.secondary" }} />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Distance
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: "text.primary" }}>
              {totalDistance}
            </Typography>
          </Box>

          {/* Duration */}
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
              <AccessTime fontSize="small" sx={{ color: "text.secondary" }} />
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Duration
              </Typography>
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 600, color: "text.primary" }}>
              {totalTime}
            </Typography>
          </Box>
        </Box>

        {/* Arrival Time */}
        <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Estimated arrival: <strong>{arrivalTime}</strong>
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

export default RouteSummaryCard
