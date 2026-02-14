// ./src/types/interfaces.ts
import { ReactNode } from "react"

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

// Isochrone related interfaces
export interface IsochroneBandProperties {
  band_index: number
  minutes: number
  mode: string
  node_count: number
  [key: string]: unknown
}

export interface IsochroneFeature
  extends GeoJSON.Feature<
    GeoJSON.Polygon | GeoJSON.MultiPolygon,
    IsochroneBandProperties
  > {}

export interface IsochroneEdgeProperties {
  edge_id: number
  band_index: number
  agg_cost: number
  street: string
  [key: string]: unknown
}

export interface IsochroneEdgeFeature
  extends GeoJSON.Feature<GeoJSON.LineString, IsochroneEdgeProperties> {}

export type IsochroneView = "polygon" | "edges"

export interface IsochroneResponse {
  features: (IsochroneFeature | IsochroneEdgeFeature)[]
  origin: { type: "Point"; coordinates: [number, number] }
}

// Waypoint routing response types (matches backend WaypointRouteResponse)
export interface LegSummary {
  distance: number // feet
  travel_time: number // minutes
}

export interface LegResponse {
  leg: number
  summary: LegSummary
  features: RouteFeature[]
}

export interface WaypointRouteSummary {
  total_distance: number
  total_travel_time: number
  num_legs: number
}

export interface WaypointRouteResponse {
  legs: LegResponse[]
  summary: WaypointRouteSummary
}

export type AppMode = "route" | "isochrone"

// Travel mode related interfaces
export type TravelMode = "drive" | "bike" | "walk"

// Message related interfaces
export type MessageLevel = "success" | "warning" | "error" | "info"

// Component props interfaces
export interface ControlsContainerProps {
  children: ReactNode
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
