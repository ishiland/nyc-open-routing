// ./src/types/interfaces.ts
import React from "react"

// Address related interfaces
export interface GeoPoint {
  type: string
  coordinates: number[]
}

// A generic interface for GeoJSON features with typed properties
export interface IMapFeature
  extends GeoJSON.Feature<
    GeoJSON.Geometry,
    { label?: string; [key: string]: unknown }
  > {}

// An interface for route data, which contains an optional array of features.
export interface IRouteData {
  features?: IMapFeature[]
}

export interface AddressProperties {
  "House Number - Display Format"?: string
  "First Street Name Normalized"?: string
  "First Borough Name"?: string
  Latitude?: string
  Longitude?: string
  [key: string]: unknown
}

export interface Address {
  type?: string
  properties?: AddressProperties
  geometry?: GeoPoint
}

// Route related interfaces
export interface RouteProperties {
  seq: number
  street: string
  distance: number
  travel_time: number
  turn_instruction?: string // Human-readable turn instruction (e.g., "Turn right onto MAIN ST")
  turn_type?: string // Machine-readable turn type for icons (e.g., "right", "slight-left", "u-turn")
  traffic_factor?: number // Traffic impact factor (1.0 = no traffic, >1.0 = delays)
  [key: string]: unknown
}

export interface RouteFeature {
  type: "Feature"
  properties: RouteProperties
  geometry: {
    type: "LineString"
    coordinates: number[][]
  }
}

export interface Route {
  features?: RouteFeature[]
  [key: string]: unknown
}

// Travel mode related interfaces
export type TravelMode = "drive" | "bike" | "walk"

// Message related interfaces
export type MessageLevel = "success" | "warning" | "error" | "info"

export interface MessageContextType {
  messageText: string
  messageLevel: MessageLevel
  messageOpen: boolean
  displayMessage: (msg: string, level?: MessageLevel) => void
  closeMessage: () => void
}

// Component props interfaces
export interface ControlsContainerProps {
  children: React.ReactNode
}

export interface SearchProps {
  type: "Start" | "End"
}

// Geosupport search result interfaces
export interface GeosupportProperties {
  label?: string
  address?: string
  id?: string
  "House Number - Display Format"?: string
  "First Street Name Normalized"?: string
  "First Borough Name"?: string
  "ZIP Code"?: string
  Latitude?: string
  Longitude?: string
  [key: string]: unknown
}

export interface GeosupportFeature {
  type: "Feature"
  properties: GeosupportProperties
  geometry: {
    type: "Point"
    coordinates: [number, number]
  }
}

export interface SearchResponse {
  features: GeosupportFeature[]
}
