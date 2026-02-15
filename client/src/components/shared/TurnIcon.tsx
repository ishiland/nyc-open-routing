// ./src/components/shared/TurnIcon.tsx
import React from "react"
import {
  ArrowUpward,
  TurnLeft,
  TurnRight,
  TurnSlightLeft,
  TurnSlightRight,
  TurnSharpLeft,
  TurnSharpRight,
  UTurnLeft,
} from "@mui/icons-material"
import { SvgIconProps } from "@mui/material"

export interface TurnIconProps extends Omit<SvgIconProps, "color"> {
  turnType?: string
  color?: "primary" | "secondary" | "action" | "disabled" | "error" | "inherit"
}

/**
 * TurnIcon component displays an icon representing a turn direction.
 *
 * Supported turn types:
 * - 'straight': Continue straight
 * - 'slight-right': Slight right turn
 * - 'right': Right turn
 * - 'sharp-right': Sharp right turn
 * - 'slight-left': Slight left turn
 * - 'left': Left turn
 * - 'sharp-left': Sharp left turn
 * - 'u-turn': U-turn
 * - 'continue': Continue (default)
 *
 * @param turnType - The turn type from the route properties
 * @param color - Material-UI icon color
 * @param props - Additional SvgIconProps
 */
export const TurnIcon: React.FC<TurnIconProps> = ({
  turnType,
  color = "inherit",
  ...props
}) => {
  const iconProps: SvgIconProps = {
    color,
    ...props,
  }

  // Render icon based on turn type using proper Material-UI turn icons
  switch (turnType) {
    case "straight":
      return <ArrowUpward {...iconProps} />

    case "slight-right":
      return <TurnSlightRight {...iconProps} />

    case "right":
      return <TurnRight {...iconProps} />

    case "sharp-right":
      return <TurnSharpRight {...iconProps} />

    case "slight-left":
      return <TurnSlightLeft {...iconProps} />

    case "left":
      return <TurnLeft {...iconProps} />

    case "sharp-left":
      return <TurnSharpLeft {...iconProps} />

    case "u-turn":
      return <UTurnLeft {...iconProps} />

    case "continue":
    default:
      return <ArrowUpward {...iconProps} />
  }
}

export default TurnIcon
