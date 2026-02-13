import React from "react"
import { render, screen, act, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest"
import { ThemeProvider } from "@mui/material/styles"
import theme from "../../utils/theme"
import { BottomSheet } from "../../components/mobile/BottomSheet"
import { AdaptiveLayout } from "../../components/layouts/AdaptiveLayout"
import { MapInstanceContext } from "../../contexts/MapInstanceContext"
import { useResponsive } from "../../hooks/useResponsive"
import { useLocalStorage } from "../../hooks/useLocalStorage"

// Mock useResponsive to control mobile/tablet/desktop states
vi.mock("../../hooks/useResponsive")

// Mock useLocalStorage to avoid localStorage side effects in tests
vi.mock("../../hooks/useLocalStorage")

describe("Keyboard Navigation and Focus Management", () => {
  beforeEach(() => {
    // Set up useLocalStorage mock to return [initialValue, setter]
    vi.mocked(useLocalStorage).mockImplementation(
      (_key: string, initialValue: unknown) =>
        [initialValue, vi.fn()] as [unknown, (v: unknown) => void],
    )

    // Set up useResponsive mock for tablet/desktop layout
    vi.mocked(useResponsive).mockReturnValue({
      isMobile: false,
      isTablet: false,
      isTabletOrBelow: true,
      isDesktop: false,
      isLargeDesktop: false,
      isTouchDevice: false,
      currentBreakpoint: "tablet",
    })
  })

  describe("BottomSheet keyboard navigation", () => {
    it("ArrowUp increases aria-valuenow on drag handle", async () => {
      const user = userEvent.setup()

      render(
        <ThemeProvider theme={theme}>
          <BottomSheet open>
            <div>Sheet content</div>
          </BottomSheet>
        </ThemeProvider>,
      )

      const slider = screen.getByRole("slider", {
        name: /resize bottom sheet/i,
      })

      // Initial snap point is 40% (0.4 * 100 = 40)
      expect(slider).toHaveAttribute("aria-valuenow", "40")

      // Focus and press ArrowUp
      await user.click(slider)
      await user.keyboard("{ArrowUp}")

      // After ArrowUp, snap point increases to 60%
      expect(slider).toHaveAttribute("aria-valuenow", "60")
    })

    it("ArrowDown decreases aria-valuenow on drag handle", async () => {
      const user = userEvent.setup()

      render(
        <ThemeProvider theme={theme}>
          <BottomSheet open initialSnapPoint={0.6}>
            <div>Sheet content</div>
          </BottomSheet>
        </ThemeProvider>,
      )

      const slider = screen.getByRole("slider", {
        name: /resize bottom sheet/i,
      })

      // Initial snap point is 60%
      expect(slider).toHaveAttribute("aria-valuenow", "60")

      // Focus and press ArrowDown
      await user.click(slider)
      await user.keyboard("{ArrowDown}")

      // After ArrowDown, snap point decreases to 40%
      expect(slider).toHaveAttribute("aria-valuenow", "40")
    })

    it("has correct ARIA attributes on drag handle", () => {
      render(
        <ThemeProvider theme={theme}>
          <BottomSheet open>
            <div>Sheet content</div>
          </BottomSheet>
        </ThemeProvider>,
      )

      const slider = screen.getByRole("slider", {
        name: /resize bottom sheet/i,
      })
      expect(slider).toHaveAttribute("aria-valuemin", "0")
      expect(slider).toHaveAttribute("aria-valuemax", "100")
      expect(slider).toHaveAttribute("aria-valuetext", "40 percent")
      expect(slider).toHaveAttribute("tabindex", "0")
    })
  })

  describe("Sidebar focus management", () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it("collapse moves focus to the expand button", () => {
      const mockMapContext = {
        map: null,
        setMap: vi.fn(),
      }

      render(
        <ThemeProvider theme={theme}>
          <MapInstanceContext.Provider value={mockMapContext}>
            <AdaptiveLayout
              sidebar={
                <div>
                  <input aria-label="Test input" />
                </div>
              }
              map={<div>Map content</div>}
            />
          </MapInstanceContext.Provider>
        </ThemeProvider>,
      )

      // Initial state: sidebar is expanded, button says "Collapse sidebar"
      const collapseBtn = screen.getByRole("button", {
        name: /collapse sidebar/i,
      })
      expect(collapseBtn).toBeInTheDocument()

      // Click collapse using fireEvent (compatible with fake timers)
      fireEvent.click(collapseBtn)

      // Advance past the 260ms focus timeout (10ms after 250ms CSS transition)
      act(() => {
        vi.advanceTimersByTime(300)
      })

      // After collapse, the expand button should have focus
      const expandBtn = screen.getByRole("button", {
        name: /expand sidebar/i,
      })
      expect(expandBtn).toHaveFocus()
    })
  })
})
