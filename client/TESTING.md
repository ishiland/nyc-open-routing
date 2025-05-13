# NYC Open Routing - Testing Guide

This document outlines the testing approach for the NYC Open Routing application.

## Testing Stack

- **Vitest**: Test runner
- **React Testing Library**: Component testing
- **Jest DOM**: DOM-based assertions
- **GitHub Actions**: CI pipeline for automated testing

## Running Tests

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with coverage report |

## Test Structure

The project follows a standard testing pattern:

```
src/
  components/
    ComponentName.tsx
    ComponentName.test.tsx
  utils/
    utility.ts
    utility.test.ts
```

## Testing Approach

### Unit Tests

Unit tests focus on isolated functions and utilities:

- **Utils**: Test utility functions (formatting, data transformation)
- **Hooks**: Test custom React hooks in isolation
- **Context**: Test context-related logic

Example:
```tsx
// formats.test.ts
it('should format distances in feet when less than 1000 feet', () => {
  expect(formatDistance(500)).toBe('500 ft');
});
```

### Component Tests

Component tests verify React components render and behave correctly:

- **Rendering**: Verify components render without errors
- **Interaction**: Test user interactions like clicks and form inputs
- **Integration**: Test how components work with contexts/providers

Example:
```tsx
// Search.test.tsx
it('updates input value correctly', async () => {
  renderSearch('Start');
  const input = screen.getByPlaceholderText('Type an address');
  await userEvent.type(input, 'Broadway');
  expect(mockSetAddressInput).toHaveBeenCalledWith('Broadway', 'Start');
});
```

### Test Utilities

The project includes test helpers and mocks:

- **setupTests.ts**: Global test configuration
- **testUtils/setup.ts**: Common test utilities
- **Mocks**: Mocked functions and API responses

## Writing New Tests

When writing new tests:

1. **Unit tests first**: Start with utility functions
2. **Component isolation**: Test components in isolation
3. **Integration tests**: Test component integration
4. **Mock APIs**: Use mockFetch for API calls
5. **Test user flows**: Focus on real user interactions

## Test Coverage Goals

The project aims for the following coverage targets:

- **Utility functions**: 100% coverage
- **Components**: >85% coverage
- **Hooks and contexts**: >85% coverage
- **Edge cases**: Test error states and boundary conditions

## CI Pipeline

The GitHub Actions CI pipeline runs tests automatically:

- On every pull request
- When pushing to main branch

This ensures all tests pass before code is merged.

## Troubleshooting Tests

Common issues:

1. **DOM errors**: Use `@testing-library/jest-dom` matchers
2. **Async tests**: Use `await` and `waitFor` for async operations
3. **Context errors**: Wrap components with necessary providers
4. **Missing mocks**: Use testUtils to mock APIs and browser features 