import React, { useContext, useState } from "react"
import {
  Box,
  Typography,
  Select,
  MenuItem,
  IconButton,
  SelectChangeEvent,
} from "@mui/material"
import ScheduleIcon from "@mui/icons-material/Schedule"
import CloseIcon from "@mui/icons-material/Close"
import { RoutingContext } from "../../contexts/RoutingContext"

const DAY_LABELS: Record<number, string> = {
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
  7: "Sun",
}

const formatHour = (hour: number): string => {
  if (hour === 0) return "12 AM"
  if (hour < 12) return `${hour} AM`
  if (hour === 12) return "12 PM"
  return `${hour - 12} PM`
}

/**
 * DepartureTimePicker component
 * Compact day/hour picker for traffic-aware routing departure time.
 * Only visible when travel mode is "drive" and traffic is enabled.
 */
export function DepartureTimePicker() {
  const {
    mode,
    useTraffic,
    trafficHour,
    trafficDayOfWeek,
    setTrafficHour,
    setTrafficDayOfWeek,
  } = useContext(RoutingContext)

  const [expanded, setExpanded] = useState(false)

  // Only show for driving mode with traffic enabled
  if (mode !== "drive" || !useTraffic) {
    return null
  }

  const isNow = trafficHour === null && trafficDayOfWeek === null

  const handleExpand = () => {
    if (isNow) {
      // Initialize with current day/hour
      const now = new Date()
      const jsDay = now.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
      const apiDay = jsDay === 0 ? 7 : jsDay // Convert to Mon=1, Sun=7
      setTrafficDayOfWeek(apiDay)
      setTrafficHour(now.getHours())
    }
    setExpanded(true)
  }

  const handleReset = () => {
    setTrafficHour(null)
    setTrafficDayOfWeek(null)
    setExpanded(false)
  }

  const handleDayChange = (event: SelectChangeEvent<number>) => {
    setTrafficDayOfWeek(event.target.value as number)
  }

  const handleHourChange = (event: SelectChangeEvent<number>) => {
    setTrafficHour(event.target.value as number)
  }

  const handleDone = () => {
    setExpanded(false)
  }

  // Custom time is set
  if (!isNow && !expanded) {
    return (
      <Box
        role="group"
        aria-label="Departure time selection"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 2,
          py: 0.5,
        }}
      >
        <ScheduleIcon fontSize="small" sx={{ color: "primary.main" }} />
        <Typography variant="caption" fontWeight={500} sx={{ flex: 1 }}>
          Leave at {DAY_LABELS[trafficDayOfWeek!]} {formatHour(trafficHour!)}
        </Typography>
        <IconButton
          size="small"
          onClick={handleReset}
          aria-label="Reset to current time"
          sx={{ p: 0.25 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    )
  }

  // Expanded state with selectors
  if (expanded) {
    return (
      <Box
        role="group"
        aria-label="Departure time selection"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 2,
          py: 0.5,
          flexWrap: "wrap",
        }}
      >
        <ScheduleIcon fontSize="small" sx={{ color: "primary.main" }} />
        <Typography variant="caption" fontWeight={500}>
          Depart:
        </Typography>
        <Select
          size="small"
          variant="standard"
          value={trafficDayOfWeek ?? 1}
          onChange={handleDayChange}
          aria-label="Departure day"
          sx={{ minWidth: 60, fontSize: "0.75rem" }}
        >
          {Object.entries(DAY_LABELS).map(([val, label]) => (
            <MenuItem key={val} value={Number(val)} dense>
              {label}
            </MenuItem>
          ))}
        </Select>
        <Select
          size="small"
          variant="standard"
          value={trafficHour ?? 0}
          onChange={handleHourChange}
          aria-label="Departure hour"
          sx={{ minWidth: 70, fontSize: "0.75rem" }}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <MenuItem key={i} value={i} dense>
              {formatHour(i)}
            </MenuItem>
          ))}
        </Select>
        <Typography
          variant="caption"
          sx={{
            cursor: "pointer",
            color: "primary.main",
            fontWeight: 500,
            "&:hover": { textDecoration: "underline" },
          }}
          onClick={handleDone}
        >
          Done
        </Typography>
        <IconButton
          size="small"
          onClick={handleReset}
          aria-label="Reset to current time"
          sx={{ p: 0.25 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
    )
  }

  // Default "Now" state
  return (
    <Box
      role="group"
      aria-label="Departure time selection"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 2,
        py: 0.5,
      }}
    >
      <ScheduleIcon fontSize="small" sx={{ color: "primary.main" }} />
      <Typography variant="caption" fontWeight={500}>
        Depart: Now
      </Typography>
      <Typography
        variant="caption"
        sx={{
          cursor: "pointer",
          color: "primary.main",
          ml: 0.5,
          "&:hover": { textDecoration: "underline" },
        }}
        onClick={handleExpand}
      >
        Change
      </Typography>
    </Box>
  )
}

export default DepartureTimePicker
