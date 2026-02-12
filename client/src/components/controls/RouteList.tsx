import React, { useContext, useCallback } from "react"
import List from "@mui/material/List"
import ListSubheader from "@mui/material/ListSubheader"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import Divider from "@mui/material/Divider"
import ListItemText from "@mui/material/ListItemText"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { formatDistance } from "../../utils/formats"
import {
  RoutingContext,
  RoutingContextType,
} from "../../contexts/RoutingContext"
import { RouteFeature } from "../../types/interfaces"
import { RouteSummaryCard } from "./RouteSummaryCard"
import { TurnIcon } from "../shared/TurnIcon"

const RouteListComponent: React.FC = () => {
  const { route, setSelectedStreet } =
    useContext<RoutingContextType>(RoutingContext)

  const handleStreetSelect = useCallback(
    (street: RouteFeature) => {
      setSelectedStreet(street)
    },
    [setSelectedStreet],
  )

  return (
    <Box sx={{ width: "100%" }}>
      {route && route.features && route.features.length ? (
        <>
          <RouteSummaryCard />
          <List
            component="nav"
            aria-labelledby="turn-by-turn-directions"
            subheader={
              <ListSubheader
                component="div"
                id="turn-by-turn-directions"
                sx={{ bgcolor: "background.paper", px: 0 }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 600, color: "text.primary" }}>
                  Turn-by-Turn Directions
                </Typography>
              </ListSubheader>
            }
            dense
            sx={{ bgcolor: "background.paper" }}
          >
          {route.features.map((street: RouteFeature) => (
            <React.Fragment key={street.properties.seq}>
              <ListItemButton onClick={() => handleStreetSelect(street)}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <TurnIcon
                    turnType={street.properties.turn_type}
                    fontSize="small"
                    color="primary"
                  />
                </ListItemIcon>
                <ListItemText
                  primary={street.properties.turn_instruction || street.properties.street}
                  slotProps={{
                    primary: {
                      noWrap: true,
                      sx: { fontWeight: "medium" },
                    },
                  }}
                  secondary={formatDistance(street.properties.distance)}
                />
              </ListItemButton>
              <Divider component="li" />
            </React.Fragment>
          ))}
        </List>
        </>
      ) : null}
    </Box>
  )
}

// Memoize component - only re-render when route changes
export const RouteList = React.memo(RouteListComponent)
