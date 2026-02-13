import "vitest-axe/extend-expect"
import { configureAxe } from "vitest-axe"

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
