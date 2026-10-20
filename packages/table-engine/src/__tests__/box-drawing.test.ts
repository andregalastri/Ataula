import { describe, it, expect } from 'vitest';
import type { TableNode } from '@edumark/shared';
import { parseGeometricTable } from '../table-parser.js';
import { formatGeometricTable, formatBoxDrawingTable } from '../table-formatter.js';
import { normalizeTableBorders } from '../table-borders.js';

function grid(rows: number, columns: number): TableNode {
  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      cells.push({
        id: row + ':' + column, row, column, rowspan: 1, colspan: 1,
        content: [String.fromCharCode(65 + row * columns + column)]
      });
    }
  }
  return { type: 'table', rowsCount: rows, colsCount: columns, cells };
}

describe('Simple box drawing', function () {
  it('draws all four corners, tees and crossings', function () {
    const table = grid(2, 2);
    expect(formatBoxDrawingTable(table)).toBe([
      '┌───┬───┐',
      '│ A │ B │',
      '├───┼───┤',
      '│ C │ D │',
      '└───┴───┘'
    ].join('\n'));
  });

  it('keeps the legacy ASCII formatter available', function () {
    expect(formatGeometricTable(grid(1, 1))).toBe('|---|\n| A |\n|---|');
  });

  it('returns an empty string for an empty table', function () {
    expect(formatBoxDrawingTable({ type: 'table', rowsCount: 0, colsCount: 0, cells: [] })).toBe('');
  });

  it('draws a colspan without a dangling vertical border', function () {
    const table = grid(2, 2);
    table.cells.splice(0, 2, { id: 'title', row: 0, column: 0, rowspan: 1, colspan: 2, content: ['Title'] });
    expect(formatBoxDrawingTable(table)).toBe([
      '┌───────┐',
      '│ Title │',
      '├───┬───┤',
      '│ C │ D │',
      '└───┴───┘'
    ].join('\n'));
    const reparsed = parseGeometricTable(formatBoxDrawingTable(table));
    expect(reparsed.cells[0].colspan).toBe(2);
  });

  it('draws partial borders around a rowspan', function () {
    const table = grid(2, 2);
    table.cells[0].rowspan = 2;
    table.cells.splice(2, 1);
    expect(formatBoxDrawingTable(table)).toBe([
      '┌───┬───┐',
      '│ A │ B │',
      '│   ├───┤',
      '│   │ D │',
      '└───┴───┘'
    ].join('\n'));
    const reparsed = parseGeometricTable(formatBoxDrawingTable(table));
    expect(reparsed.cells[0].rowspan).toBe(2);
  });

  it('preserves literal punctuation and drawing glyphs in cell text', function () {
    const table = grid(1, 2);
    table.cells[0].content = ['a─b │ c'];
    table.cells[1].content = ['x-y | z'];
    const rendered = formatBoxDrawingTable(table);
    expect(rendered).toContain('a─b │ c');
    expect(rendered).toContain('x-y | z');
    const reparsed = parseGeometricTable(rendered);
    expect(reparsed.cells.map(function (cell) { return cell.content; })).toEqual([['a─b │ c'], ['x-y | z']]);
  });

  it('keeps a literal vertical glyph inside a colspan', function () {
    const table = grid(2, 2);
    table.cells.splice(0, 2, { id: 'title', row: 0, column: 0, rowspan: 1, colspan: 2, content: ['x │ y'] });
    const rendered = formatBoxDrawingTable(table);
    expect(parseGeometricTable(rendered).cells[0].content).toEqual(['x │ y']);
  });

  it('keeps multi-line cell content', function () {
    const table = grid(1, 2);
    table.cells[0].content = ['first', 'second'];
    const reparsed = parseGeometricTable(formatBoxDrawingTable(table));
    expect(reparsed.cells[0].content).toEqual(['first', 'second']);
    expect(reparsed.cells[1].content).toEqual(['B']);
  });

  it('retains explicitly preserved column widths', function () {
    const table = grid(1, 1);
    table.colWidths = [10];
    expect(formatBoxDrawingTable(table, true).split('\n')[0]).toBe('┌──────────┐');
  });

  it('normalizes Unicode without changing offsets or CRLF endings', function () {
    const text = 'Before\r\n┌───┐\r\n│ A │\r\n└───┘\r\nAfter';
    const expected = 'Before\r\n|---|\r\n| A |\r\n|---|\r\nAfter';
    expect(normalizeTableBorders(text)).toBe(expected);
    expect(normalizeTableBorders(text).length).toBe(text.length);
  });

  it('does not normalize standalone glyphs outside a table', function () {
    const text = 'A │ B ─ C\n│ plain text │';
    expect(normalizeTableBorders(text)).toBe(text);
  });

  it('preserves mixed ASCII layout markers in a Unicode table', function () {
    const text = '┌───┬───┐-\n│ A │ B │\n└───┴───┘\n|-';
    expect(normalizeTableBorders(text)).toBe('|---|---|-\n| A | B |\n|---|---|\n|-');
  });

  it('normalizes each table independently in a document', function () {
    const text = '┌───┐\n│ A │\n└───┘\n\nText │ remains\n\n┌───┐\n│ B │\n└───┘';
    expect(normalizeTableBorders(text)).toBe('|---|\n| A |\n|---|\n\nText │ remains\n\n|---|\n| B |\n|---|');
  });

  it('is stable when formatting and reparsing rectangular grids', function () {
    for (let rows = 1; rows <= 5; rows++) {
      for (let columns = 1; columns <= 5; columns++) {
        const table = grid(rows, columns);
        table.cells[table.cells.length - 1].content = ['ação', 'path/a_b-c'];
        const rendered = formatBoxDrawingTable(table);
        expect(formatBoxDrawingTable(parseGeometricTable(rendered))).toBe(rendered);
      }
    }
  });
});
