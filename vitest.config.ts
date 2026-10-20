import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@edumark/table-engine': resolve(__dirname, 'packages/table-engine/src/index.ts'),
      '@edumark/shared': resolve(__dirname, 'packages/shared/src/index.ts'),
      vscode: resolve(__dirname, 'vscode-mock.ts')
    }
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/**/src/**/*.test.ts'],
    exclude: ['**/src/test/e2e/**', '**/dist/**']
  }
});
