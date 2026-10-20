import { test, expect } from 'vitest';
import fc from 'fast-check';
import type { TableNode } from '@edumark/shared';
import { parseGeometricTable } from '../table-parser.js';
import { formatGeometricTable, formatBoxDrawingTable } from '../table-formatter.js';

const text = fc.array(fc.constantFrom('a', 'b', 'é', ' ', '-', '_', '/', '.'), { maxLength: 12 })
  .map(chars => ('v' + chars.join('')).trimEnd());

const tables = fc.tuple(fc.integer({ min: 1, max: 5 }), fc.integer({ min: 1, max: 5 }))
  .chain(([rows, columns]) => fc.array(fc.array(text, { minLength: 1, maxLength: 3 }), {
    minLength: rows * columns, maxLength: rows * columns
  }).map(contents => ({
    type: 'table' as const, rowsCount: rows, colsCount: columns,
    cells: contents.map((content, index) => ({
      id: String(index), row: Math.floor(index / columns), column: index % columns,
      rowspan: 1, colspan: 1, content
    }))
  })));

test('ASCII and box drawing format/parse are stable for generated tables', () => {
  fc.assert(fc.property(tables, (table: TableNode) => {
    for (const format of [formatGeometricTable, formatBoxDrawingTable]) {
      const rendered = format(table);
      const parsed = parseGeometricTable(rendered);
      expect(parsed.rowsCount).toBe(table.rowsCount);
      expect(parsed.colsCount).toBe(table.colsCount);
      expect(parsed.cells.map(cell => cell.content)).toEqual(
        table.cells.map(cell => cell.content.map(line => line.trimEnd()))
      );
      expect(format(parsed)).toBe(rendered);
    }
  }), { numRuns: 100, seed: 20261020 });
});
