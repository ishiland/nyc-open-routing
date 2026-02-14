---
phase: 07-departure-time-picker
verified: 2026-02-14T19:30:00Z
status: human_needed
score: 4/4 truths verified
re_verification: false
human_verification:
  - test: "Visual appearance and interaction flow"
    expected: "Picker shows 'Depart: Now' by default, expands to day/hour selectors on 'Change' click, collapses to 'Leave at [Day] [Time]' summary after selection, resets to 'Now' on clear button click"
    why_human: "Three-state UI interaction flow and visual layout require human verification"
  - test: "Visibility based on mode and traffic toggle"
    expected: "Picker appears only in drive mode with traffic enabled, hidden in bike/walk modes or when traffic toggle is off"
    why_human: "Conditional rendering based on user interaction requires human testing"
  - test: "Day and hour selection functionality"
    expected: "User can select any day Mon-Sun (1-7) and any hour 12AM-11PM (0-23), displayed in 12-hour format with AM/PM"
    why_human: "Dropdown interaction and value display formatting require human verification"
  - test: "Route auto-recalculation on departure time change"
    expected: "When user changes day or hour, route automatically recalculates (via existing ButtonControls effect)"
    why_human: "Integration with existing route fetching logic requires end-to-end testing"
---

# Phase 07: Departure Time Picker Verification Report

**Phase Goal:** User can select a departure day and hour from a compact picker that appears only when traffic routing is active

**Verified:** 2026-02-14T19:30:00Z

**Status:** human_needed

**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User sees a departure time picker in the sidebar when traffic toggle is enabled in drive mode | ✓ VERIFIED | Component checks `mode === "drive" && useTraffic === true` (line 49), returns null otherwise. Wired into ControlsContainer after TrafficToggle. |
| 2 | Picker defaults to "Now" and displays "Leave at [day] [time]" when a custom departure is selected | ✓ VERIFIED | Three UI states: default "Depart: Now" (lines 186-216), expanded selectors (lines 115-183), summary "Leave at {day} {time}" (lines 86-113). State check: `isNow = trafficHour === null && trafficDayOfWeek === null` (line 53). |
| 3 | User can reset the picker back to "Now" with a single action | ✓ VERIFIED | Close button present in both expanded and summary states (lines 103-110, 174-181), calls `handleReset()` which sets both values to null (lines 67-71). |
| 4 | Picker is hidden when traffic toggle is off or when bike/walk mode is selected | ✓ VERIFIED | Visibility check returns null if `mode !== "drive" || !useTraffic` (lines 49-51). Component never renders in non-drive modes or when traffic is disabled. |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `client/src/components/controls/DepartureTimePicker.tsx` | Compact departure day/hour picker component | ✓ VERIFIED | 220 lines, implements three-state UI (Now/expanded/summary), day select (Mon-Sun, values 1-7), hour select (12AM-11PM, values 0-23 with 12-hour display formatting). Accessibility: role="group", aria-labels on selects and buttons. |
| `client/src/components/ControlsContainer.tsx` | Renders DepartureTimePicker after TrafficToggle | ✓ VERIFIED | Imports DepartureTimePicker (line 9), renders between TrafficToggle and FerryToggle (line 32). Correct positioning in controls header Box. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| DepartureTimePicker.tsx | RoutingContext.tsx | useContext reads mode, useTraffic, trafficHour, trafficDayOfWeek and calls setTrafficHour, setTrafficDayOfWeek | ✓ WIRED | Import on line 12, useContext call on line 44, destructures all 6 expected values. State read on lines 38-44, setters called in handleReset (lines 68-69), handleDayChange (line 74), handleHourChange (line 78), handleExpand (lines 61-62). |
| ControlsContainer.tsx | DepartureTimePicker.tsx | import and render after TrafficToggle | ✓ WIRED | Import on line 9, render on line 32, positioned after TrafficToggle (line 31) and before FerryToggle (line 33). |

### Requirements Coverage

| Requirement | Status | Supporting Truth | Blocking Issue |
|-------------|--------|------------------|----------------|
| TIME-01: User can select a departure day and hour via a compact picker in the sidebar | ✓ SATISFIED | Truth 1 | None |
| TIME-02: Picker defaults to "Now" and shows "Leave at [day] [time]" when custom time is set | ✓ SATISFIED | Truth 2 | None |
| TIME-03: User can reset to "Now" with a single action | ✓ SATISFIED | Truth 3 | None |
| TIME-06: Departure time picker is only shown when traffic toggle is enabled (drive mode) | ✓ SATISFIED | Truths 1, 4 | None |

**Note:** Requirements TIME-04 (API param passing) and TIME-05 (URL persistence) are deferred to Phase 8, as documented in REQUIREMENTS.md.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | - | - | - | - |

**Analysis:**
- No TODO/FIXME/PLACEHOLDER comments found
- No console.log statements
- No empty stub implementations
- Conditional `return null` (line 50) is intentional visibility logic, not a stub
- Component implements full three-state UI with proper event handlers
- All state changes use RoutingContext setters (no local-only state)

### Human Verification Required

#### 1. Visual Appearance and Three-State UI Flow

**Test:** 
1. Set mode to "drive" and enable traffic toggle
2. Observe the default "Depart: Now" state with "Change" button
3. Click "Change" to expand to day/hour selectors
4. Select a day and hour from the dropdowns
5. Click "Done" to collapse to summary state
6. Verify summary shows "Leave at [Day] [Time]" format (e.g., "Leave at Wed 3 PM")
7. Click the close button to reset back to "Now"

**Expected:**
- Default state: ScheduleIcon + "Depart: Now" + "Change" text button
- Expanded state: ScheduleIcon + "Depart:" label + Day dropdown + Hour dropdown + "Done" button + Close button
- Summary state: ScheduleIcon + "Leave at [Day] [Time]" + Close button
- All three states use compact inline layout matching TrafficToggle/FerryToggle styling
- Select dropdowns display day abbreviations (Mon-Sun) and 12-hour time format (12 AM - 11 PM)

**Why human:** Three-state UI interaction flow, visual layout, and responsive behavior require human verification. Cannot programmatically verify visual appearance, dropdown interaction, or layout compactness.

#### 2. Visibility Based on Mode and Traffic Toggle

**Test:**
1. Start in drive mode with traffic off → picker should be hidden
2. Enable traffic toggle → picker should appear
3. Switch to bike mode (traffic still on) → picker should hide
4. Switch to walk mode → picker should remain hidden
5. Switch back to drive mode → picker should appear (since traffic is still on)
6. Disable traffic toggle → picker should hide

**Expected:**
- Picker visible ONLY when mode="drive" AND useTraffic=true
- Picker hidden in all other combinations (bike mode, walk mode, drive mode with traffic off)
- Visibility changes immediately when mode or traffic toggle changes

**Why human:** Conditional rendering based on user interaction (mode selection, traffic toggle) requires human testing across multiple state combinations.

#### 3. Day and Hour Selection Functionality

**Test:**
1. Expand the picker (click "Change")
2. Verify day dropdown shows all 7 days (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
3. Verify hour dropdown shows all 24 hours in 12-hour format (12 AM, 1 AM, ..., 11 AM, 12 PM, 1 PM, ..., 11 PM)
4. Select different day and hour combinations
5. Verify the summary state displays the selected values correctly
6. Verify the values persist when toggling between expanded and summary states

**Expected:**
- Day dropdown: 7 options (Mon=1, Tue=2, ..., Sun=7)
- Hour dropdown: 24 options (0-23 internally, displayed as 12-hour format)
- Summary displays correct day abbreviation and formatted time
- Selected values persist in RoutingContext state
- Values initialize to current day/hour when first expanding from "Now" state

**Why human:** Dropdown interaction, value selection, display formatting, and state persistence require human verification.

#### 4. Route Auto-Recalculation on Departure Time Change

**Test:**
1. Set up a route (origin and destination)
2. Enable traffic toggle
3. Select a departure time (e.g., Mon 8 AM)
4. Observe if route recalculates automatically
5. Change the hour (e.g., to 5 PM)
6. Observe if route recalculates again
7. Change the day (e.g., to Sat)
8. Observe if route recalculates again

**Expected:**
- Route automatically recalculates when trafficHour or trafficDayOfWeek changes
- ButtonControls effect (existing) should trigger useRouteFetch when departure time state changes
- No manual "Calculate" button click required
- Network request should include the selected hour and day_of_week params

**Why human:** Integration with existing route fetching logic (ButtonControls effect, useRouteFetch) requires end-to-end testing. Cannot verify network request params programmatically without running the app.

### Overall Assessment

**Automated Verification:** All observable truths verified, all artifacts exist and are substantive, all key links wired correctly, no anti-patterns detected.

**Code Quality:**
- Component follows existing control patterns (TrafficToggle, FerryToggle)
- Proper TypeScript typing
- Accessibility features (role, aria-labels)
- Clean separation of concerns (RoutingContext for state, component for UI)
- No code smells or stubs

**Integration:**
- Correctly wired into ControlsContainer in the expected position
- Reads and updates RoutingContext state as specified
- Visibility logic matches requirements (drive mode + traffic enabled)

**Human Verification Needed:**
- Visual appearance and three-state UI interaction flow
- Conditional visibility based on mode and traffic toggle
- Day and hour selection dropdown interaction
- Integration with existing route recalculation logic

---

*Verified: 2026-02-14T19:30:00Z*
*Verifier: Claude (gsd-verifier)*
