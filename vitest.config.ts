import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    // Run unit tests from the tests/unit/ directory
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      // Enforce 80% line coverage on all lib/ files
      include: ['lib/**'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      reporter: ['text', 'html', 'lcov'],
    },
  },
});
