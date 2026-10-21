import { describe, expect, it } from 'vitest';
import { formatBoxDrawingTable, normalizeTableBorders, parseGeometricTable } from '@edumark/table-engine';
import type { TableNode } from '@edumark/shared';
import { editNestedTable, focusTable, formatNestedTable, hasNestedTables, nestedTableSeed } from '../table-nesting';

function table(contents: string[][]): string {
  const node: TableNode = { type: 'table', rowsCount: 1, colsCount: contents.length,
    cells: contents.map((content, column) => ({ id: String(column), row: 0, column, rowspan: 1, colspan: 1, content })) };
  return formatBoxDrawingTable(node);
}
const child = table([['A'], ['B']]);
const outer = table([['Antes', '', ...child.split('\n'), '', 'Depois']]);
function point(text: string, word: string, offset = 0) {
  const lines = text.split('\n');
  const line = lines.findIndex(line => line.includes(word));
  return { line, character: lines[line].indexOf(word) + offset };
}

describe('Independent boxes inside table cells', () => {
  it('does not project the inner columns through the surrounding prose', () => {
    const parsed = parseGeometricTable(outer, false, true, true);
    expect(parsed.rowsCount).toBe(1);
    expect(parsed.colsCount).toBe(1);
    expect(parsed.cells[0].content).toEqual(['Antes', '', ...child.split('\n'), '', 'Depois']);
    expect(formatBoxDrawingTable(parsed)).toBe(outer);
    expect(formatBoxDrawingTable(parseGeometricTable(normalizeTableBorders(outer), false, true, true))).toBe(outer);
    expect(hasNestedTables(outer)).toBe(true);
    expect(hasNestedTables(child)).toBe(false);
  });

  it('expands the inner column and enclosing box without changing their topology', () => {
    const at = point(outer, '│ A │', 3);
    const result = editNestedTable(outer, at, at, 'long')!;
    expect(result.text).toBe(table([['Antes', '', ...table([['Along'], ['B']]).split('\n'), '', 'Depois']]));
    expect(result.cursor).toEqual(point(result.text, 'Along', 5));
    const parsed = parseGeometricTable(result.text);
    expect(parsed.cells).toHaveLength(1);
    const focus = focusTable(result.text, result.cursor);
    expect(parseGeometricTable(focus.text).colsCount).toBe(2);
  });

  it('Enter expands the child height and preserves the sibling cell and following prose', () => {
    const at = point(outer, '│ A │', 3);
    const result = editNestedTable(outer, at, at, '\nX')!;
    const expanded = table([['A', 'X'], ['B']]);
    expect(result.text).toBe(table([['Antes', '', ...expanded.split('\n'), '', 'Depois']]));
    expect(result.cursor).toEqual(point(result.text, 'X', 1));
  });

  it('shrinks the child and all ancestors on deletion', () => {
    const wide = table([['Before', ...table([['Long text'], ['B']]).split('\n'), 'After']]);
    const result = editNestedTable(wide, point(wide, 'Long text', 1), point(wide, 'Long text', 9), '')!;
    expect(result.text).toBe(table([['Before', ...table([['L'], ['B']]).split('\n'), 'After']]));
    expect(result.cursor).toEqual(point(result.text, '│ L │', 3));
  });

  it('handles three levels of boxes', () => {
    const deep = table([['Level 1', ...outer.split('\n'), 'End']]);
    const at = point(deep, '│ A │', 3);
    const result = editNestedTable(deep, at, at, 'Z')!;
    expect(result.text).toContain('│ AZ │ B │');
    expect(result.cursor).toEqual(point(result.text, 'AZ', 2));
    expect(parseGeometricTable(result.text).colsCount).toBe(1);
    expect(result.text).toContain('Level 1');
    expect(result.text).toContain('Depois');
  });

  it('edits prose outside the inner box without changing its contents', () => {
    const at = point(outer, 'Antes', 5);
    const result = editNestedTable(outer, at, at, '!')!;
    expect(result.text).toBe(table([['Antes!', '', ...child.split('\n'), '', 'Depois']]));
  });

  it('keeps separate nested tables in different cells and consecutive blocks', () => {
    const two = table([[...child.split('\n'), '', ...child.split('\n')], ['Side', ...child.split('\n')]]);
    const result = formatNestedTable(two);
    expect(result).toBe(two);
    expect(parseGeometricTable(result).colsCount).toBe(2);
  });

  it('reformats padding inside nested cells without flattening the parent', () => {
    const padded = table([['Heading', ...table([['  A'], ['   B']]).split('\n'), 'Footer']]);
    expect(formatNestedTable(padded, true)).toBe(table([['Heading', ...child.split('\n'), 'Footer']]));
  });

  it('creates an inner table from the existing seed syntax', () => {
    const text = table([['Before', '  |2x2', 'After']]);
    const seed = nestedTableSeed(text, point(text, '|2x2', 4))!;
    expect(seed.text).toBe('|2x2');
    const created = formatBoxDrawingTable({ type: 'table', rowsCount: 2, colsCount: 2,
      cells: Array.from({length:4}, (_, index) => ({ id: String(index), row: Math.floor(index / 2), column: index % 2, rowspan: 1, colspan: 1, content: [''] })) });
    const result = seed.replace(created, {line:1, character:2});
    expect(result.text).toBe(table([['Before', ...created.split('\n').map(line => '  ' + line), 'After']]));
    expect(result.cursor).toEqual({line:3, character:6});
  });

  it('preserves the existing merged-cell topology around a nested table', () => {
    const merged: TableNode = { type: 'table', rowsCount: 2, colsCount: 2, cells: [
      { id:'title', row:0, column:0, rowspan:1, colspan:2, content:['Title'] },
      { id:'left', row:1, column:0, rowspan:1, colspan:1, content:child.split('\n') },
      { id:'right', row:1, column:1, rowspan:1, colspan:1, content:['Other'] }
    ] };
    const text = formatBoxDrawingTable(merged);
    expect(formatNestedTable(text)).toBe(text);
    const parsed = parseGeometricTable(text);
    expect(parsed.rowsCount).toBe(2);
    expect(parsed.colsCount).toBe(2);
    expect(parsed.cells[0].colspan).toBe(2);
  });
});
