import { test, expect } from 'vitest';
import { parseGeometricTable } from '../table-parser.js';
import { formatGeometricTable } from '../table-formatter.js';

test('format snapshot for complex table', () => {
  const raw = '|---|---|\n| abc | defghi |\n|---|---|';
  const parsed = parseGeometricTable(raw, false, false, true);
  expect(formatGeometricTable(parsed)).toMatchSnapshot();
});
