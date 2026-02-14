import React, { createContext, useState, ReactNode, useCallback, useMemo } from "react"
import { IsochroneResponse, AppMode, IsochroneView } from "../types/interfaces"

export interface IsochroneContextType {
  appMode: AppMode
  isochrone: IsochroneResponse | null
  intervals: number[]
  isochroneView: IsochroneView
  setAppMode: (mode: AppMode) => void
  setIsochrone: (data: IsochroneResponse | null) => void
  setIntervals: (intervals: number[]) => void
  setIsochroneView: (view: IsochroneView) => void
}

export const IsochroneContext = createContext<IsochroneContextType>({
  appMode: "route",
  isochrone: null,
  intervals: [5, 10, 15, 20],
  isochroneView: "polygon",
  setAppMode: () => {},
  setIsochrone: () => {},
  setIntervals: () => {},
  setIsochroneView: () => {},
})

interface IsochroneContextProviderProps {
  children: ReactNode
}

export function IsochroneContextProvider({ children }: IsochroneContextProviderProps) {
  const [appMode, setAppModeState] = useState<AppMode>("route")
  const [isochrone, setIsochroneState] = useState<IsochroneResponse | null>(null)
  const [intervals, setIntervalsState] = useState<number[]>([5, 10, 15, 20])
  const [isochroneView, setIsochroneViewState] = useState<IsochroneView>("polygon")

  const setAppMode = useCallback((mode: AppMode) => {
    setAppModeState(mode)
    // Clear isochrone data when switching back to route mode
    if (mode === "route") {
      setIsochroneState(null)
    }
  }, [])

  const setIsochrone = useCallback((data: IsochroneResponse | null) => {
    setIsochroneState(data)
  }, [])

  const setIntervals = useCallback((newIntervals: number[]) => {
    setIntervalsState(newIntervals)
  }, [])

  const setIsochroneView = useCallback((view: IsochroneView) => {
    setIsochroneViewState(view)
    setIsochroneState(null)
  }, [])

  const value = useMemo(
    () => ({
      appMode,
      isochrone,
      intervals,
      isochroneView,
      setAppMode,
      setIsochrone,
      setIntervals,
      setIsochroneView,
    }),
    [appMode, isochrone, intervals, isochroneView, setAppMode, setIsochrone, setIntervals, setIsochroneView],
  )

  return (
    <IsochroneContext.Provider value={value}>{children}</IsochroneContext.Provider>
  )
}
