import React from "react"
import Paper from "@mui/material/Paper"
import Box from "@mui/material/Box"

import { AppModeToggle } from "./controls/AppModeToggle"
import { TravelModeSelect } from "./controls/TravelModeSelect"
import { TrafficToggle } from "./controls/TrafficToggle"
import { FerryToggle } from "./controls/FerryToggle"
import { DepartureTimePicker } from "./controls/DepartureTimePicker"
import { TitleBar } from "./shared/TitleBar"
import { ControlsContainerProps } from "../types/interfaces"

const ControlsContainerComponent: React.FC<ControlsContainerProps> = ({
  children,
}) => {
  return (
    <Paper
      square
      sx={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
      }}
      elevation={8}
    >
      <TitleBar />
      <Box sx={{ px: 1.5, pt: 1 }}>
        <AppModeToggle />
        <TravelModeSelect />
        <TrafficToggle />
        <DepartureTimePicker />
        <FerryToggle />
      </Box>
      <Box
        sx={{
          padding: 1.5,
          overflowY: "auto",
          flexGrow: 1,
          bgcolor: "grey.50",
        }}
      >
        {children}
      </Box>
    </Paper>
  )
}

// Memoize to prevent unnecessary re-renders
export const ControlsContainer = React.memo(ControlsContainerComponent)
