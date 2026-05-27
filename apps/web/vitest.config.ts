import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    globals: false,
  },
  resolve: {
    alias: {
      '@wordcourt/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
      '@': path.resolve(__dirname),
    },
  },
});
