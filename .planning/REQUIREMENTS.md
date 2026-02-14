# Requirements: NYC Open Routing

**Defined:** 2026-02-14
**Core Value:** The UI must feel like a native NYC tool — compact, bold, and immediately usable

## v2.1 Requirements

Requirements for departure time feature. Each maps to roadmap phases.

### Departure Time

- [ ] **TIME-01**: User can select a departure day and hour via a compact picker in the sidebar
- [ ] **TIME-02**: Picker defaults to "Now" (current time) and shows "Leave at [day] [time]" when a custom time is set
- [ ] **TIME-03**: User can reset to "Now" with a single action
- [ ] **TIME-04**: Selected departure time is passed as `hour` and `day_of_week` to route and isochrone API calls
- [ ] **TIME-05**: Departure time persists in URL query params for shareable deep links
- [ ] **TIME-06**: Departure time picker is only shown when traffic toggle is enabled (drive mode)

## Future Requirements

None identified.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-time traffic updates | Requires persistent data pipeline, separate milestone |
| Arrival time ("Arrive by") | Reverse time calculation adds complexity, defer |
| Minute-level granularity | Backend uses hour-level traffic data, minute precision isn't meaningful |
| Date picker (specific calendar date) | Traffic data is day-of-week based, not calendar-date specific |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| TIME-01 | — | Pending |
| TIME-02 | — | Pending |
| TIME-03 | — | Pending |
| TIME-04 | — | Pending |
| TIME-05 | — | Pending |
| TIME-06 | — | Pending |

**Coverage:**
- v2.1 requirements: 6 total
- Mapped to phases: 0
- Unmapped: 6 ⚠️

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after initial definition*
