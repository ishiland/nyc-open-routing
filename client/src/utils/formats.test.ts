import { describe, it, expect } from 'vitest';
import { 
  formatDistance, 
  formatTotalRouteTime, 
  formatTotalRouteDistance
} from './formats';

describe('formatDistance', () => {
  it('should format distances in feet when less than 1000 feet', () => {
    expect(formatDistance(500)).toBe('500 ft');
    expect(formatDistance(0)).toBe('0 ft');
    expect(formatDistance(999)).toBe('999 ft');
  });

  it('should format distances in miles when greater than 1000 feet', () => {
    expect(formatDistance(5260)).toBe('1.0 mi');
    expect(formatDistance(10520)).toBe('2.0 mi');
    expect(formatDistance(7890)).toBe('1.5 mi');
  });
});

describe('formatTotalRouteTime', () => {
  it('should format times in minutes when less than an hour', () => {
    const routes = [
      { properties: { travel_time: 15, distance: 1000 } },
      { properties: { travel_time: 10, distance: 500 } }
    ];
    expect(formatTotalRouteTime(routes)).toBe('25 min');
  });

  it('should format times in hours and minutes when more than an hour', () => {
    const routes = [
      { properties: { travel_time: 40, distance: 1000 } },
      { properties: { travel_time: 30, distance: 500 } },
      { properties: { travel_time: 20, distance: 300 } }
    ];
    expect(formatTotalRouteTime(routes)).toBe('1 hr 30 min');
  });
});

describe('formatTotalRouteDistance', () => {
  it('should correctly sum and format the total distance', () => {
    const routes = [
      { properties: { travel_time: 15, distance: 1000 } },
      { properties: { travel_time: 10, distance: 2000 } }
    ];
    expect(formatTotalRouteDistance(routes)).toBe('3000 ft');

    const longRoutes = [
      { properties: { travel_time: 15, distance: 2630 } },
      { properties: { travel_time: 10, distance: 2630 } }
    ];
    expect(formatTotalRouteDistance(longRoutes)).toBe('1.0 mi');
  });
}); 