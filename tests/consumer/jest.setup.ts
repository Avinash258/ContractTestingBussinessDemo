/** Retry once for rare Pact mock / socket races on CI agents. */
jest.retryTimes(1, { logErrorsBeforeRetry: true });
