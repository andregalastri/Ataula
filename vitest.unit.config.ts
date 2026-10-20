import { defineConfig } from 'vitest/config';
import config from './vitest.config';

export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: [
      'packages/**/src/__tests__/**/*.test.ts',
      'packages/table-engine/src/table-engine.test.ts'
    ],
    exclude: ['**/parser.props.test.ts']
  }
});
