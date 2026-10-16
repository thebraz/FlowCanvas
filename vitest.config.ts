import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node',
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: [
        'src/domain/**/*.ts',
        'src/engine/**/*.ts',
        'src/application/**/*.ts',
        'src/state/store.ts',
        'src/adapters/persistence/**/*.ts',
        'src/validation/**/*.ts',
      ],
      reporter: ['text', 'json-summary', 'html'],
    },
  },
});
