import React, { useContext } from "react"
import AppBar from "@mui/material/AppBar"
import Tabs from "@mui/material/Tabs"
import Tab from "@mui/material/Tab"
import {
  DirectionsBike,
  DirectionsCar,
  DirectionsWalk,
} from "@mui/icons-material"
import { RoutingContext, TravelMode } from "../../contexts/RoutingContext"

export const TravelModeSelect: React.FC = () => {
  const { mode, setMode } = useContext(RoutingContext)

  const tabSx = {
    minWidth: "auto",
    flexGrow: 1,
    minHeight: 64, // Increased height for icon + label
  }

  return (
    <AppBar position="static" color="default">
      <Tabs
        value={mode}
        onChange={(event, newValue: TravelMode) => setMode(newValue)}
        indicatorColor="primary"
        textColor="primary"
        variant="fullWidth"
      >
        <Tab
          icon={<DirectionsCar />}
          label="Drive"
          value="drive"
          sx={tabSx}
          aria-label="Driving Directions"
        />
        <Tab
          icon={<DirectionsBike />}
          label="Bike"
          value="bike"
          sx={tabSx}
          aria-label="Biking Directions"
        />
        <Tab
          icon={<DirectionsWalk />}
          label="Walk"
          value="walk"
          sx={tabSx}
          aria-label="Walking Directions"
        />
      </Tabs>
    </AppBar>
  )
}
