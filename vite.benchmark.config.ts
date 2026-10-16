import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwind()],
  build: {
    outDir: 'dist-benchmark',
    manifest: true,
    rolldownOptions: {
      input: [
        'tests/performance/index.html',
        'tests/performance/stage2.html',
        'tests/performance/stage3.html',
        'tests/performance/stage4.html',
      ],
    },
  },
});
