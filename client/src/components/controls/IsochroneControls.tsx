import React, { useContext } from "react"
import Button from "@mui/material/Button"
import Box from "@mui/material/Box"
import Stack from "@mui/material/Stack"
import Typography from "@mui/material/Typography"
import CircularProgress from "@mui/material/CircularProgress"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import ToggleButton from "@mui/material/ToggleButton"
import { Layers } from "@mui/icons-material"

import {
  RoutingContext,
  RoutingContextType,
} from "../../contexts/RoutingContext"
import { IsochroneContext } from "../../contexts/IsochroneContext"
import {
  MessageContext,
  MessageContextType,
} from "../../contexts/MessageContext"
import { useIsochroneFetch } from "../../hooks/useIsochroneFetch"
import { IsochroneFeature, IsochroneView } from "../../types/interfaces"
import { ISOCHRONE_BAND_COLORS } from "../../utils/style"

export const IsochroneControls: React.FC = () => {
  const { startAddress, mode, useTraffic, trafficHour, trafficDayOfWeek } =
    useContext<RoutingContextType>(RoutingContext)
  const {
    isochrone,
    intervals,
    isochroneView,
    setIsochrone,
    setIsochroneView,
  } = useContext(IsochroneContext)
  const { displayMessage } = useContext<MessageContextType>(MessageContext)

  const { fetchIsochrone, isFetching } = useIsochroneFetch({
    startAddress,
    mode,
    intervals,
    isochroneView,
    useTraffic,
    trafficHour,
    trafficDayOfWeek,
    setIsochrone,
    displayMessage,
  })

  const canAnalyze = !!startAddress?.geometry

  const handleClear = () => {
    setIsochrone(null)
  }

  return (
    <>
      <Box
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: "absolute",
          left: "-10000px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        {isFetching && "Calculating reachability..."}
      </Box>

      <ToggleButtonGroup
        value={isochroneView}
        exclusive
        onChange={(_e, val) => val && setIsochroneView(val as IsochroneView)}
        size="small"
        fullWidth
        sx={{ mb: 1.5 }}
        aria-label="Isochrone visualization type"
      >
        <ToggleButton value="polygon" aria-label="Polygon fill view">
          Fill
        </ToggleButton>
        <ToggleButton value="edges" aria-label="Street segments view">
          Streets
        </ToggleButton>
      </ToggleButtonGroup>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <Button
          onClick={fetchIsochrone}
          variant="contained"
          color="success"
          disabled={isFetching || !canAnalyze}
          startIcon={
            isFetching ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <Layers />
            )
          }
          aria-label="Analyze reachability from selected address"
          fullWidth
          sx={{ minHeight: 44 }}
        >
          {isFetching ? "Calculating..." : "Analyze Reachability"}
        </Button>
        {isochrone && (
          <Button
            onClick={handleClear}
            variant="outlined"
            disabled={isFetching}
            aria-label="Clear reachability results"
            sx={{ minHeight: 44, minWidth: 44 }}
          >
            Clear
          </Button>
        )}
      </Stack>

      {isochrone && isochrone.features.length > 0 && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {isochroneView === "edges"
              ? "Reachable streets by time"
              : "Reachable area by time"}
          </Typography>
          <Stack spacing={0.5}>
            {isochroneView === "polygon"
              ? ([...isochrone.features] as IsochroneFeature[])
                  .sort(
                    (a, b) => a.properties.band_index - b.properties.band_index,
                  )
                  .map(f => (
                    <Stack
                      key={f.properties.band_index}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                    >
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          bgcolor:
                            ISOCHRONE_BAND_COLORS[
                              f.properties.band_index - 1
                            ] || "#94a3b8",
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2">
                        {f.properties.minutes} min
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({f.properties.node_count.toLocaleString()} nodes)
                      </Typography>
                    </Stack>
                  ))
              : (() => {
                  // Group edge features by band_index, count edges per band
                  const bandCounts = new Map<number, number>()
                  isochrone.features.forEach(f => {
                    const bi = f.properties.band_index
                    bandCounts.set(bi, (bandCounts.get(bi) || 0) + 1)
                  })
                  const bands = [...bandCounts.entries()].sort(
                    (a, b) => a[0] - b[0],
                  )
                  return bands.map(([bandIndex, count]) => (
                    <Stack
                      key={bandIndex}
                      direction="row"
                      alignItems="center"
                      spacing={1}
                    >
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          bgcolor:
                            ISOCHRONE_BAND_COLORS[bandIndex - 1] || "#94a3b8",
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2">
                        {bandIndex * 5} min
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({count.toLocaleString()} streets)
                      </Typography>
                    </Stack>
                  ))
                })()}
          </Stack>
        </Box>
      )}
    </>
  )
}
