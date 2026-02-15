# NYC Open Routing - Theming Guide

## Overview

This document describes the theming approach used in the NYC Open Routing application. We've centralized all styling in the Material UI theme system to ensure consistency and make it easier to update styles throughout the application.

## Theme Structure

The theme is defined in `utils/theme.ts` and extends the standard Material UI theme with custom properties for map styling.

### Standard Theme Properties

- `palette`: Defines colors for Material UI components
- `typography`: Defines text styles
- `spacing`: Defines spacing units

### Custom Map Theme Properties

We've extended the theme to include map-specific styling:

- `map.startPoint.color`: Color for start point markers
- `map.endPoint.color`: Color for end point markers
- `map.route.color`: Color for route lines
- `map.route.width`: Width for route lines
- `map.point.radius`: Radius for point markers
- `map.point.blur`: Blur effect for point markers
- `map.point.strokeWidth`: Width of the stroke around point markers
- `map.point.strokeColor`: Color of the stroke around point markers

## Usage Guidelines

### Using Theme in Components

Import the `useTheme` hook from Material UI:

```tsx
import { useTheme } from "@mui/material/styles"

const MyComponent = () => {
  const theme = useTheme()

  return (
    <Box
      sx={{
        backgroundColor: theme.palette.primary.main,
        padding: theme.spacing(2),
      }}
    />
  )
}
```

### Using Theme for Map Features

For map features, access the custom map properties:

```tsx
const RouteLayer = () => {
  const theme = useTheme()

  // Use theme values for map styling
  const routePaint = {
    "line-width": theme.map.route.width,
    "line-color": theme.map.route.color,
  }

  // ...
}
```

### Advantages of Theme-Based Styling

1. **Consistency**: Ensures consistent styling across the application
2. **Maintainability**: Makes it easier to update styles in one place
3. **Dark Mode Support**: Facilitates the future addition of dark mode
4. **Responsiveness**: Makes it easier to adjust styles based on screen size

## Best Practices

1. Always use theme tokens instead of hardcoded values
2. Use Material UI's `sx` prop for component-specific styling
3. Access theme values with the `useTheme` hook
4. Use theme.spacing() for consistent spacing
5. Use theme.palette for consistent colors
