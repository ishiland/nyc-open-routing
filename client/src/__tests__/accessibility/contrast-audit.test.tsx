import { describe, it, expect } from "vitest"
import { MODE_COLORS } from "../../utils/theme"

// Relative luminance calculation (WCAG 2.1 formula)
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLinear = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1)
  const l2 = relativeLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

describe("Mode Color Contrast Compliance", () => {
  it("walk mode selected state meets AA contrast (4.5:1) with black text", () => {
    // Walk mode uses black text (#000) on orange (#E65100) background
    const ratio = contrastRatio(MODE_COLORS.walk, "#000000")
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it("drive mode selected state meets AA contrast (4.5:1) with white text", () => {
    // Drive mode uses white text (#fff) on MTA blue (#0039A6) background
    const ratio = contrastRatio(MODE_COLORS.drive, "#ffffff")
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it("bike mode selected state meets AA contrast (4.5:1) with white text", () => {
    // Bike mode uses white text (#fff) on dark green (#087F23) background
    const ratio = contrastRatio(MODE_COLORS.bike, "#ffffff")
    expect(ratio).toBeGreaterThanOrEqual(4.5)
  })

  it("MODE_COLORS exports expected hex values", () => {
    expect(MODE_COLORS.drive).toBe("#0039A6")
    expect(MODE_COLORS.bike).toBe("#087F23")
    expect(MODE_COLORS.walk).toBe("#E65100")
  })
})
