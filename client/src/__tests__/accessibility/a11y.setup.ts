import { expect } from "vitest"
import { configureAxe } from "vitest-axe"
import * as vitestAxeMatchers from "vitest-axe/matchers"

// Register toHaveNoViolations matcher with vitest
expect.extend(vitestAxeMatchers)

// Configure axe for WCAG 2.1 AA rules
// color-contrast disabled because jsdom does not compute visual styles
export const a11yAxe = configureAxe({
  rules: {
    "color-contrast": { enabled: false },
  },
  runOnly: {
    type: "tag",
    values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
  },
})
