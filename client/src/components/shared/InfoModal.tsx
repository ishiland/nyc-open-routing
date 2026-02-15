import React, { useState } from "react"
import Typography from "@mui/material/Typography"
import Modal from "@mui/material/Modal"
import Button from "@mui/material/Button"
import Box from "@mui/material/Box"
import Link from "@mui/material/Link"
import Divider from "@mui/material/Divider"
import IconButton from "@mui/material/IconButton"
import { InfoOutlined, Close, GitHub } from "@mui/icons-material"

const ExternalLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children,
}) => (
  <Link href={href} target="_blank" rel="noopener noreferrer" underline="hover">
    {children}
  </Link>
)

const InfoModal: React.FC = () => {
  const [open, setOpen] = useState<boolean>(false)

  return (
    <Box>
      <Button
        onClick={() => setOpen(true)}
        aria-label="About NYC Open Routing"
        sx={{ color: "white" }}
      >
        <InfoOutlined sx={{ mr: 1 }} />
      </Button>
      <Modal
        aria-labelledby="modal-title"
        aria-describedby="modal-description"
        open={open}
        onClose={() => setOpen(false)}
      >
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: { xs: "90%", sm: 460 },
            maxHeight: "85vh",
            overflowY: "auto",
            bgcolor: "background.paper",
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
            <Typography
              variant="h6"
              id="modal-title"
              component="h2"
              sx={{ flex: 1 }}
            >
              NYC Open Routing
            </Typography>
            <IconButton
              size="small"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <Close fontSize="small" />
            </IconButton>
          </Box>

          <Typography
            variant="body2"
            id="modal-description"
            color="text.secondary"
            sx={{ mb: 2 }}
          >
            A proof-of-concept multi-modal routing application for New York
            City. Supports driving, biking, and walking directions with
            turn-by-turn navigation, isochrone analysis, and live traffic
            conditions.
          </Typography>

          <Divider sx={{ mb: 1.5 }} />

          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Data Sources
          </Typography>

          <Box
            component="ul"
            sx={{ m: 0, pl: 2.5, mb: 1.5, "& li": { mb: 0.5 } }}
          >
            <li>
              <Typography variant="body2">
                <strong>Street Network</strong> &mdash;{" "}
                <ExternalLink href="https://www.nyc.gov/site/planning/data-maps/open-data/dwn-lion.page">
                  LION
                </ExternalLink>{" "}
                (Linear Integrated Ordered Network) from NYC Dept. of City
                Planning
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Live Traffic</strong> &mdash;{" "}
                <ExternalLink href="https://data.cityofnewyork.us/Transportation/DOT-Traffic-Speeds-NBE/i4gi-tjb9">
                  NYC DOT Traffic Speeds
                </ExternalLink>{" "}
                via TRANSCOM real-time speed sensors on NYC Open Data
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Address Search</strong> &mdash;{" "}
                <ExternalLink href="https://www.nyc.gov/site/planning/data-maps/open-data/dwn-gdelx.page">
                  Geosupport
                </ExternalLink>{" "}
                geocoder from NYC Dept. of City Planning
              </Typography>
            </li>
            <li>
              <Typography variant="body2">
                <strong>Base Map</strong> &mdash;{" "}
                <ExternalLink href="https://www.openstreetmap.org/about">
                  OpenStreetMap
                </ExternalLink>{" "}
                via OpenMapTiles
              </Typography>
            </li>
          </Box>

          <Divider sx={{ mb: 1.5 }} />

          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Routing Engine
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Routes are computed using{" "}
            <ExternalLink href="https://pgrouting.org/">pgRouting</ExternalLink>{" "}
            with the Turn-Restricted Shortest Path (TRSP) algorithm. The graph
            models one-way streets, grade-separated intersections, and
            mode-specific accessibility. Live traffic factors adjust drive-mode
            edge costs based on real-time sensor observations.
          </Typography>

          <Divider sx={{ mb: 1.5 }} />

          <Typography
            variant="caption"
            color="text.secondary"
            display="block"
            sx={{ mb: 2 }}
          >
            This is an experimental project and not intended for real-world
            navigation. Routes may be inaccurate or incomplete.
          </Typography>

          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Button
              size="small"
              startIcon={<GitHub />}
              href="https://github.com/ishiland/nyc-open-routing"
              target="_blank"
              rel="noopener noreferrer"
              sx={{ textTransform: "none" }}
            >
              View on GitHub
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </Box>
        </Box>
      </Modal>
    </Box>
  )
}

export default InfoModal
