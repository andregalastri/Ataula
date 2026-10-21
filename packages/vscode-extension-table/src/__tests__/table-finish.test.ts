import { describe, expect, it } from 'vitest';
import { findBoxRegions, formatBoxDrawingTable, parseGeometricTable } from '@edumark/table-engine';
import type { TableNode } from '@edumark/shared';
import { extendTable, presentationTablesAt } from '../table-finish';
import { editNestedTable } from '../table-nesting';

const simple = '┌───┬───┐\n│ A │ B │\n└───┴───┘';
function box(lines: string[], minimum = 0): string {
  const width = Math.max(1, minimum, ...lines.map(line => line.length)) + 2;
  return ['┌' + '─'.repeat(width) + '┐', ...lines.map(line => '│ ' + line.padEnd(width - 2) + ' │'), '└' + '─'.repeat(width) + '┘'].join('\n');
}
function point(text: string, word: string, offset = 0) {
  const lines = text.split('\n');
  const line = lines.findIndex(line => line.includes(word));
  return {line, character: lines[line].indexOf(word) + offset};
}
function topology(text: string) {
  const table = parseGeometricTable(text, false, true, true);
  return {rows:table.rowsCount, columns:table.colsCount, cells:table.cells.map(cell => ({row:cell.row,column:cell.column,rowspan:cell.rowspan,colspan:cell.colspan,content:cell.content}))};
}

describe('Presentation width command', () => {
  it('grows only the final column to the requested absolute position', () => {
    const at = point(simple, 'A');
    const result = extendTable(simple, at, 20)!;
    expect(result.text.split('\n').map(line => line.length)).toEqual([20,20,20]);
    expect(result.text.split('\n')[0].indexOf('┬')).toBe(4);
    expect(topology(result.text)).toEqual(topology(simple));
    expect(result.cursor).toEqual(at);
  });

  it('includes all leading indentation and comment characters in the target', () => {
    const result = extendTable(simple, point(simple, 'B'), 80, 7)!;
    expect(result.text.split('\n').every(line => line.length + 7 === 80)).toBe(true);
  });

  it('keeps manually broken lines, leading spaces and literal drawing characters unchanged', () => {
    const source = box(['  text | │ ─', '', '  next line']);
    const oldRight = source.split('\n')[0].length - 1;
    const result = extendTable(source, point(source, 'text'), 60)!;
    expect(result.text.split('\n').map(line => line.slice(0, oldRight))).toEqual(source.split('\n').map(line => line.slice(0, oldRight)));
    expect(result.text.split('\n')).toHaveLength(source.split('\n').length);
  });

  it('does nothing at or beyond the target, including a prefix wider than the target', () => {
    const at = point(simple, 'A');
    expect(extendTable(simple, at, 9)).toBeUndefined();
    expect(extendTable(simple, at, 8)).toBeUndefined();
    expect(extendTable(simple, at, 5, 10)).toBeUndefined();
  });

  it('moves a cursor on the final border with that border', () => {
    const result = extendTable(simple, {line:0,character:8}, 20)!;
    expect(result.cursor).toEqual({line:0,character:19});
    expect(result.text.split('\n')[0][result.cursor.character]).toBe('┐');
  });

  it('handles a final column with a vertical merge and partial horizontal borders', () => {
    const source = '┌───┬───┐\n│ A │ B │\n├───┤   │\n│ C │   │\n└───┴───┘';
    const result = extendTable(source, point(source, 'A'), 30)!;
    expect(topology(result.text)).toEqual(topology(source));
    expect(result.text.split('\n')[2]).toBe('├───┤' + ' '.repeat(24) + '│');
  });

  it('extends the horizontal portions of partial borders in the last column', () => {
    const source = '┌───┬───┐\n│ A │ B │\n│   ├───┤\n│   │ C │\n└───┴───┘';
    const result = extendTable(source, point(source, 'A'), 30)!;
    expect(topology(result.text)).toEqual(topology(source));
    expect(result.text.split('\n')[2]).toBe('│   ├' + '─'.repeat(24) + '┤');
  });

  it('keeps horizontal merges while extending the same final grid column', () => {
    const source = '┌───────┐\n│ Title │\n├───┬───┤\n│ A │ B │\n└───┴───┘';
    const result = extendTable(source, point(source, 'Title'), 30)!;
    expect(topology(result.text)).toEqual(topology(source));
    expect(result.text.split('\n')[2].indexOf('┬')).toBe(4);
  });

  it('fills the parent cell while keeping the parent perimeter fixed', () => {
    const source = box(['Before', ...simple.split('\n'), 'After'], 35);
    const result = extendTable(source, point(source, '│ A │', 3), 1000)!;
    const before = findBoxRegions(source);
    const after = findBoxRegions(result.text);
    expect(after[0]).toEqual(before[0]);
    expect(after[1].right).toBe(before[0].right - 2);
    expect(result.text.split('\n')[0]).toBe(source.split('\n')[0]);
    expect(result.text.split('\n').map(line => line.length)).toEqual(source.split('\n').map(line => line.length));
    expect(topology(result.expandedTable)).toEqual(topology(simple));
  });

  it('uses the containing cell boundary when the parent has multiple columns', () => {
    const node: TableNode = {type:'table', rowsCount:1, colsCount:2, cells:[
      {id:'left',row:0,column:0,rowspan:1,colspan:1,content:['Heading wide enough for more room', ...simple.split('\n')]},
      {id:'right',row:0,column:1,rowspan:1,colspan:1,content:['Keep me']}
    ]};
    const source = formatBoxDrawingTable(node);
    const right = source.split('\n')[0].indexOf('┬');
    const result = extendTable(source, point(source, '│ A │', 3), 1000)!;
    expect(findBoxRegions(result.text)[1].right).toBe(right - 2);
    expect(result.text.split('\n').map(line => line.slice(right))).toEqual(source.split('\n').map(line => line.slice(right)));
  });

  it('uses the immediate parent in three levels of nesting', () => {
    const middle = box(['Middle', ...simple.split('\n')], 25);
    const source = box(['Outer', ...middle.split('\n')], 45);
    const result = extendTable(source, point(source, '│ A │', 3), 1000)!;
    const before = findBoxRegions(source);
    const after = findBoxRegions(result.text);
    expect(after.slice(0,2)).toEqual(before.slice(0,2));
    expect(after[2].right).toBe(before[1].right - 2);
  });

  it('does not overwrite text beside an inner table', () => {
    const source = box(simple.split('\n').map(line => line + ' tail'), 30);
    expect(extendTable(source, point(source, '│ A │', 3), 1000)).toBeUndefined();
  });

  it('preserves CRLF and rejects unsupported input and invalid settings', () => {
    expect(extendTable(simple.replaceAll('\n','\r\n'), {line:1,character:2}, 20)!.text.split('\r\n')).toHaveLength(3);
    expect(extendTable('ordinary text', {line:0,character:2}, 80)).toBeUndefined();
    for (const column of [0,-1,1.5,NaN,Infinity]) expect(extendTable(simple, {line:1,character:2}, column)).toBeUndefined();
  });

  it('resets the presentation width on the next content edit without changing content breaks', () => {
    const result = extendTable(simple, point(simple, 'A', 1), 80)!;
    const edited = editNestedTable(result.text, result.cursor, result.cursor, 'X', false)!;
    expect(edited.text).toBe('┌────┬───┐\n│ AX │ B │\n└────┴───┘');
    expect(edited.cursor).toEqual(point(edited.text, 'AX', 2));
  });

  it('recognizes finalized ancestors and children only on the edited path', () => {
    const outer = box(['Before', ...simple.split('\n')], 35);
    const result = extendTable(outer, point(outer, '│ A │', 3), 80)!;
    const marked = new Set([result.expandedTable]);
    expect(presentationTablesAt(result.text, result.cursor, marked)).toEqual([result.expandedTable]);
    expect(presentationTablesAt(result.text, point(result.text, 'Before'), marked)).toEqual([]);
    marked.add(result.text);
    expect(presentationTablesAt(result.text, result.cursor, marked)).toHaveLength(2);
  });
});
