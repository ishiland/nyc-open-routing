import React, { useContext } from "react"
import {
  Box,
  Typography,
  Slider,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  SelectChangeEvent,
} from "@mui/material"
import AccessTimeIcon from "@mui/icons-material/AccessTime"
import { RoutingContext } from "../../contexts/RoutingContext"

/**
 * TimeSelector component
 * Provides hour and day-of-week selection for time-specific traffic routing.
 * Only visible when travel mode is "drive" and traffic is enabled.
 */
export function TimeSelector() {
  const { mode, useTraffic, trafficHour, trafficDayOfWeek, setTrafficHour, setTrafficDayOfWeek } =
    useContext(RoutingContext)

  // Only show for driving mode with traffic enabled
  if (mode !== "drive" || !useTraffic) {
    return null
  }

  const handleHourChange = (_event: Event, value: number | number[]) => {
    setTrafficHour(typeof value === "number" ? value : value[0])
  }

  const handleDayChange = (event: SelectChangeEvent<number>) => {
    setTrafficDayOfWeek(event.target.value as number)
  }

  const handleUseCurrentTime = () => {
    if (isUsingCurrentTime) {
      // Currently using current time (null) - switch to manual selection
      // Initialize with current time values
      setTrafficHour(new Date().getHours())
      setTrafficDayOfWeek(new Date().getDay() || 7)
    } else {
      // Currently manual - switch back to current time
      setTrafficHour(null)
      setTrafficDayOfWeek(null)
    }
  }

  // Format hour as 12-hour time
  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM"
    if (hour < 12) return `${hour} AM`
    if (hour === 12) return "12 PM"
    return `${hour - 12} PM`
  }

  const dayNames = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

  const isUsingCurrentTime = trafficHour === null || trafficDayOfWeek === null

  return (
    <Box
      sx={{
        paddingX: 2,
        paddingY: 2,
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        backgroundColor: "rgba(0, 0, 0, 0.02)",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <AccessTimeIcon fontSize="small" color="action" />
        <Typography variant="body2" fontWeight="medium">
          Traffic Time
        </Typography>
      </Box>

      <Box sx={{ mb: 2 }}>
        <Button
          size="small"
          variant={isUsingCurrentTime ? "outlined" : "contained"}
          onClick={handleUseCurrentTime}
          fullWidth
          sx={{ mb: 2 }}
        >
          {isUsingCurrentTime ? "Set Specific Time" : "Use Current Time"}
        </Button>

        <Typography variant="caption" color="text.secondary" gutterBottom display="block">
          Hour: {trafficHour !== null ? formatHour(trafficHour) : "Current"}
        </Typography>
        <Slider
          value={trafficHour ?? new Date().getHours()}
          onChange={handleHourChange}
          min={0}
          max={23}
          step={1}
          aria-label="Hour of day"
          marks={[
            { value: 0, label: "12 AM" },
            { value: 6, label: "6 AM" },
            { value: 12, label: "12 PM" },
            { value: 18, label: "6 PM" },
          ]}
          valueLabelDisplay="auto"
          valueLabelFormat={formatHour}
          disabled={isUsingCurrentTime}
          sx={{ mt: 3, mb: 2 }}
        />

        <FormControl fullWidth size="small" disabled={isUsingCurrentTime}>
          <InputLabel>Day of Week</InputLabel>
          <Select
            value={trafficDayOfWeek ?? (new Date().getDay() || 7)}
            onChange={handleDayChange}
            label="Day of Week"
          >
            {dayNames.slice(1).map((day, index) => (
              <MenuItem key={index + 1} value={index + 1}>
                {day}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Typography variant="caption" color="text.secondary">
        {isUsingCurrentTime
          ? "Routes use live traffic conditions"
          : `Showing traffic for ${dayNames[(trafficDayOfWeek ?? 1)]} at ${formatHour((trafficHour ?? 0))}`}
      </Typography>
    </Box>
  )
}

export default TimeSelector
