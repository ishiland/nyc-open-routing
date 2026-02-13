import React, { useContext, useCallback } from "react"
import List from "@mui/material/List"
import ListSubheader from "@mui/material/ListSubheader"
import ListItemButton from "@mui/material/ListItemButton"
import ListItemIcon from "@mui/material/ListItemIcon"
import Divider from "@mui/material/Divider"
import ListItemText from "@mui/material/ListItemText"
import Box from "@mui/material/Box"
import Typography from "@mui/material/Typography"
import { Directions } from "@mui/icons-material"
import { formatDistance } from "../../utils/formats"
import {
  RoutingContext,
  RoutingContextType,
} from "../../contexts/RoutingContext"
import { MODE_COLORS } from "../../utils/theme"
import { RouteFeature } from "../../types/interfaces"
import { RouteSummaryCard } from "./RouteSummaryCard"
import { TurnIcon } from "../shared/TurnIcon"

const RouteListComponent: React.FC = () => {
  const { route, mode, selectedStreet, setSelectedStreet } =
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
          {route.features.map((street: RouteFeature) => {
            const isActive = selectedStreet?.properties.seq === street.properties.seq
            return (
              <React.Fragment key={street.properties.seq}>
                <ListItemButton
                  onClick={() => handleStreetSelect(street)}
                  selected={isActive}
                  aria-label={street.properties.turn_instruction || street.properties.street}
                  sx={{
                    "&.Mui-selected": {
                      bgcolor: `${MODE_COLORS[mode]}14`,
                      borderLeft: 3,
                      borderColor: MODE_COLORS[mode],
                      "&:hover": {
                        bgcolor: `${MODE_COLORS[mode]}1F`,
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <TurnIcon
                      turnType={street.properties.turn_type}
                      fontSize="small"
                      sx={{ color: MODE_COLORS[mode] }}
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={street.properties.turn_instruction || street.properties.street}
                    slotProps={{
                      primary: {
                        noWrap: true,
                        sx: { fontWeight: 500, fontSize: "0.875rem" },
                      },
                      secondary: {
                        sx: { fontSize: "0.75rem" },
                      },
                    }}
                    secondary={formatDistance(street.properties.distance)}
                  />
                </ListItemButton>
                <Divider component="li" />
              </React.Fragment>
            )
          })}
        </List>
        </>
      ) : (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Directions sx={{ color: "text.disabled", fontSize: 48 }} />
          <Typography variant="subtitle2" sx={{ mt: 1 }}>
            Get started
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Enter a start and end address above, then tap Get Directions.
          </Typography>
        </Box>
      )}
    </Box>
  )
}

// Memoize component - only re-render when route changes
export const RouteList = React.memo(RouteListComponent)
