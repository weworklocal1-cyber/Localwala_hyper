import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/tests/**/*.test.ts', 'services/*/tests/**/*.test.ts'],
    environment: 'node',
    pool: 'forks',
    reporters: ['default'],
    passWithNoTests: false,
  },
});
