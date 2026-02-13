import React from "react"
import { render, screen } from "@testing-library/react"
import { vi, describe, it, expect, beforeEach } from "vitest"
import { ThemeProvider } from "@mui/material/styles"
import * as vitestAxeMatchers from "vitest-axe/matchers"
import theme from "../../utils/theme"
import {
  RoutingContext,
  RoutingContextType,
} from "../../contexts/RoutingContext"
import { a11yAxe } from "./a11y.setup"

// Register toHaveNoViolations matcher with vitest
expect.extend(vitestAxeMatchers)

// Components under test
import { TrafficToggle } from "../../components/controls/TrafficToggle"
import { FerryToggle } from "../../components/controls/FerryToggle"
import InfoModal from "../../components/shared/InfoModal"
import { TravelModeSelect } from "../../components/controls/TravelModeSelect"
import { TimeSelector } from "../../components/controls/TimeSelector"

// Shared mock context (same pattern as Search.test.tsx)
const mockContextValue: RoutingContextType = {
  startAddress: null,
  endAddress: null,
  mode: "drive",
  route: null,
  selectedStreet: null,
  useTraffic: true,
  avoidFerries: false,
  trafficHour: null,
  trafficDayOfWeek: null,
  setAddress: vi.fn(),
  setAddressInput: vi.fn(),
  startAddressInput: "",
  endAddressInput: "",
  clearAddresses: vi.fn(),
  swapAddresses: vi.fn(),
  isInputEnabled: true,
  enableAddressInputs: vi.fn(),
  setMode: vi.fn(),
  setRoute: vi.fn(),
  setSelectedStreet: vi.fn(),
  setUseTraffic: vi.fn(),
  setAvoidFerries: vi.fn(),
  setTrafficHour: vi.fn(),
  setTrafficDayOfWeek: vi.fn(),
}

const renderWithContext = (
  ui: React.ReactElement,
  contextOverrides: Partial<RoutingContextType> = {},
) => {
  const contextValue = { ...mockContextValue, ...contextOverrides }
  return render(
    <ThemeProvider theme={theme}>
      <RoutingContext.Provider value={contextValue}>
        {ui}
      </RoutingContext.Provider>
    </ThemeProvider>,
  )
}

describe("ARIA Labels Accessibility Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("TrafficToggle", () => {
    it("has accessible switch with correct name", () => {
      renderWithContext(<TrafficToggle />, { mode: "drive" })
      // MUI Switch renders input[type=checkbox] with aria-label
      const toggle = screen.getByLabelText(/enable traffic routing/i)
      expect(toggle).toBeInTheDocument()
      expect(toggle.tagName).toBe("INPUT")
    })

    it("passes axe-core audit", async () => {
      const { container } = renderWithContext(<TrafficToggle />, {
        mode: "drive",
      })
      const results = await a11yAxe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe("FerryToggle", () => {
    it("has accessible switch with correct name", () => {
      renderWithContext(<FerryToggle />, { mode: "bike" })
      const toggle = screen.getByLabelText(/avoid ferries/i)
      expect(toggle).toBeInTheDocument()
      expect(toggle.tagName).toBe("INPUT")
    })

    it("passes axe-core audit", async () => {
      const { container } = renderWithContext(<FerryToggle />, {
        mode: "bike",
      })
      const results = await a11yAxe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe("InfoModal", () => {
    it("has accessible button with correct name", () => {
      renderWithContext(<InfoModal />)
      expect(
        screen.getByRole("button", { name: /about nyc open routing/i }),
      ).toBeInTheDocument()
    })

    it("passes axe-core audit", async () => {
      const { container } = renderWithContext(<InfoModal />)
      const results = await a11yAxe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe("TravelModeSelect", () => {
    it("has accessible buttons for all travel modes", () => {
      renderWithContext(<TravelModeSelect />)
      expect(
        screen.getByRole("button", { name: /driving directions/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /biking directions/i }),
      ).toBeInTheDocument()
      expect(
        screen.getByRole("button", { name: /walking directions/i }),
      ).toBeInTheDocument()
    })

    it("passes axe-core audit", async () => {
      const { container } = renderWithContext(<TravelModeSelect />)
      const results = await a11yAxe(container)
      expect(results).toHaveNoViolations()
    })
  })

  describe("TimeSelector", () => {
    it("has accessible slider with correct name", () => {
      renderWithContext(<TimeSelector />, {
        mode: "drive",
        useTraffic: true,
        trafficHour: 12,
        trafficDayOfWeek: 1,
      })
      expect(
        screen.getByRole("slider", { name: /hour of day/i }),
      ).toBeInTheDocument()
    })

    it("passes axe-core audit", async () => {
      const { container } = renderWithContext(<TimeSelector />, {
        mode: "drive",
        useTraffic: true,
        trafficHour: 12,
        trafficDayOfWeek: 1,
      })
      const results = await a11yAxe(container)
      expect(results).toHaveNoViolations()
    })
  })
})
