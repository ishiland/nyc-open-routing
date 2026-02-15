# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/).

## [4.1] - 2026-02-15

### Added

- CI status badge in README
- README screenshots for all major features
- Social preview image for GitHub link sharing
- CHANGELOG.md

### Changed

- GitHub repo description and topic tags updated for discoverability

## [4.0] - 2026-02-15

### Added

- Live traffic data refresh from TRANSCOM speed sensors (auto-updates every 5 minutes)
- Traffic visualization map layer with green/yellow/orange/red color scale
- Traffic status API endpoint reporting data freshness
- Manual traffic refresh endpoint for development
- Traffic layer toggle independent of route traffic setting
- Viewport-bounded traffic data loading for performance
- Traffic freshness indicator ("Updated X min ago")

### Changed

- SQL routing functions use combined fallback chain: live speed factor, static volume factor, default 1.0

## [3.0] - 2026-02-14

### Added

- Professional README with feature highlights and tech stack badges
- MIT license
- CONTRIBUTING.md with development setup and code style guidelines
- GitHub Actions CI workflow (lint, test, build, Docker smoke test)

### Changed

- Codebase reviewed for KISS principles -- dead code removed, abstractions simplified
- Repository cleaned of debug screenshots, build artifacts, and internal dev notes

## [2.3] - 2026-02-14

### Fixed

- Ferry route network isolation -- ferry internal nodes no longer connect to bridge/tunnel nodes
- Ferry terminals accessible only at street-network endpoints

## [2.2] - 2026-02-14

### Added

- Edge-based isochrone visualization showing reachable streets colored by travel time band
- Toggle between polygon fill and edge-based isochrone views
- Multi-stop waypoint routing with up to 3 intermediate stops
- Per-leg directions and route summaries for waypoint routes

## [2.1] - 2026-02-14

### Added

- Departure time picker for traffic-aware routing (day of week + hour)
- Departure time parameters passed to route and isochrone API calls
- Departure time persists in URL for shareable deep links

## [2.0] - 2026-02-14

### Added

- Isochrone reachability analysis with polygon fill visualization
- Drive, bike, and walk isochrone modes
- Configurable time intervals (5, 10, 15, 20 minutes)
- App mode toggle between routing and isochrone analysis

### Fixed

- Turn restriction generation for grade-separated intersections
- Map layer ordering for route and isochrone overlays

## [1.1] - 2026-02-13

### Fixed

- Sidebar collapse toggle integrated into TitleBar (no more info button click interception)
- Shared deep links correctly restore travel mode on page load
- Mobile autocomplete suggestions visible above bottom sheet

### Added

- Collapsed sidebar icon rail with travel mode indicator and tooltips
- Contextual hint text when no route has been calculated
- Smooth map control appearance on initial page load

## [1.0] - 2026-02-13

### Added

- MTA-inspired design system (blue #0039A6, red #EE352E, orange #FF6319)
- Inter font with bold weights and tight type scale
- Compact sidebar with transit-inspired search inputs
- Travel mode selector with mode-specific color accents (drive=blue, bike=green, walk=orange)
- Turn-by-turn directions with click-to-zoom on map
- Responsive layout: desktop sidebar, tablet narrow panel, mobile bottom sheet with swipe gestures
- Keyboard navigation and ARIA labels for accessibility
- WCAG AA contrast compliance
