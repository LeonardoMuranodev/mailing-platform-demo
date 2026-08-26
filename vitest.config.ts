import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/services/**', 'src/controllers/**', 'src/middlewares/**'],
    },
    // Resolver aliases: los imports usan .js pero los archivos son .ts
    alias: {
      '^(.*)\\.js$': '$1',
    },
  },
});
