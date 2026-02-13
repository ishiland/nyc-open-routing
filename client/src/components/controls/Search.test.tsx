import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"
import { vi } from "vitest"
import Search from "./Search"
import {
  RoutingContext,
  RoutingContextType,
} from "../../contexts/RoutingContext"
import useDebouncedFetch from "../../hooks/useDebouncedFetch"

// Mock the useDebouncedFetch hook
vi.mock("../../hooks/useDebouncedFetch", () => ({
  default: vi.fn(),
}))

// Mock context values
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

const renderSearch = (type: "Start" | "End", contextOverrides = {}) => {
  const contextValue = { ...mockContextValue, ...contextOverrides }
  return render(
    <RoutingContext.Provider value={contextValue}>
      <Search type={type} />
    </RoutingContext.Provider>,
  )
}

describe("Search Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default mock implementation for useDebouncedFetch
    ;(useDebouncedFetch as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      {
        data: null,
        loading: false,
        error: null,
        setQuery: vi.fn(),
        query: "",
        reset: vi.fn(),
      },
    )
  })

  it("renders with label text", () => {
    renderSearch("Start")
    expect(screen.getByLabelText("From")).toBeInTheDocument()
  })

  it("is disabled when isInputEnabled is false", () => {
    renderSearch("Start", { isInputEnabled: false })
    expect(screen.getByLabelText("From")).toBeDisabled()
  })

  it("updates input value correctly for Start type", async () => {
    renderSearch("Start")
    const input = screen.getByLabelText("From")

    await userEvent.type(input, "Broadway")

    // setAddressInput is called for each character typed
    expect(mockContextValue.setAddressInput).toHaveBeenCalledWith("y", "start")
  })

  it("updates input value correctly for End type", async () => {
    renderSearch("End")
    const input = screen.getByLabelText("To")

    await userEvent.type(input, "Times Square")

    // setAddressInput is called for each character typed
    expect(mockContextValue.setAddressInput).toHaveBeenCalledWith("e", "end")
  })

  it("calls setQuery when input changes", async () => {
    const mockSetQuery = vi.fn()
    ;(useDebouncedFetch as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      {
        data: null,
        loading: false,
        error: null,
        setQuery: mockSetQuery,
        query: "",
        reset: vi.fn(),
      },
    )

    renderSearch("Start")
    const input = screen.getByLabelText("From")

    await userEvent.type(input, "Bro")

    // setQuery should be called for each character
    expect(mockSetQuery).toHaveBeenCalled()
  })

  it("uses useDebouncedFetch hook with correct parameters", () => {
    renderSearch("Start")

    // Verify hook was called with correct options
    expect(useDebouncedFetch).toHaveBeenCalledWith({
      url: "/api/search",
      queryParam: "address",
      minLength: 3,
      enabled: true,
    })
  })

  it("renders helper text when input is less than 3 characters", () => {
    renderSearch("Start", { startAddressInput: "ab" })

    expect(
      screen.getByText("Enter at least 3 characters to search"),
    ).toBeInTheDocument()
  })
})
