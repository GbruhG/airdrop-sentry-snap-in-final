// Jest custom matchers type declarations
declare namespace jest {
  interface Matchers<R> {
    toBeValidSentryIssue(): R;
    toBeValidSentryUser(): R;
  }
}