import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `globals: true` keeps the existing suites working with bare `describe` /
    // `it` / `expect`, as they were written against Jest under tsdx v0.
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
