/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/consumer/**/*.spec.ts'],
  testTimeout: 30000,
  maxWorkers: 1,
  clearMocks: true,
  verbose: true,
  transform: {
    '^.+\\.[tj]sx?$': 'babel-jest',
  },
  // Pact + its ESM proxy deps must be transformed for Jest CJS runtime
  transformIgnorePatterns: [
    'node_modules/(?!(@pact-foundation|https-proxy-agent|agent-base|proxy-agent-negotiate)/)',
  ],
};
