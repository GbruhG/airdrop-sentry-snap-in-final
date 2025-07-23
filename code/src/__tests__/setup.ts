// Test setup file for Jest
// This file runs before each test file

// Mock console.log to reduce noise during tests unless explicitly needed
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  // Suppress console logs during tests unless VERBOSE_TESTS is set
  if (!process.env.VERBOSE_TESTS) {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
  }
});

afterEach(() => {
  // Restore console functions
  if (!process.env.VERBOSE_TESTS) {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
  }
  
  // Clear all mocks after each test
  jest.clearAllMocks();
});

// Global test configuration
jest.setTimeout(30000);

// Mock environment variables for consistent testing
process.env.NODE_ENV = 'test';

// Setup default mock implementations for common dependencies
jest.mock('dotenv', () => ({
  config: jest.fn(() => ({
    parsed: {
      DEVREV_PAT: 'test-pat-token',
      SENTRY_AUTH_TOKEN: 'test-sentry-token',
    },
  })),
}));

// Global error handler for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Global test utilities - moved to separate declaration file

// Custom Jest matchers for Sentry data validation
expect.extend({
  toBeValidSentryIssue(received) {
    const pass = 
      typeof received === 'object' &&
      typeof received.id === 'string' &&
      typeof received.title === 'string' &&
      typeof received.firstSeen === 'string' &&
      typeof received.lastSeen === 'string';

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid Sentry issue`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid Sentry issue with required fields (id, title, firstSeen, lastSeen)`,
        pass: false,
      };
    }
  },

  toBeValidSentryUser(received) {
    const pass = 
      typeof received === 'object' &&
      typeof received.id === 'string' &&
      typeof received.email === 'string';

    if (pass) {
      return {
        message: () => `expected ${JSON.stringify(received)} not to be a valid Sentry user`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${JSON.stringify(received)} to be a valid Sentry user with required fields (id, email)`,
        pass: false,
      };
    }
  },
});