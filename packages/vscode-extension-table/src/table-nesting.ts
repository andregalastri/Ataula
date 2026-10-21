import type { TableCell, TableNode } from '@edumark/shared';
import { containsBox, findBoxRegions, formatBoxDrawingTable, normalizeTableBorders, parseGeometricTable } from '@edumark/table-engine';
import type { BoxRegion } from '@edumark/table-engine';

export interface Point { line: number; character: number }
export interface TableResult { text: string; cursor: Point }
export interface TableBlock { start: number; end: number; text: string; cursor: Point }
interface Surface { node: TableNode; lines: string[]; horizontal: number[]; vertical: number[] }
interface CellPoint { cell: TableCell; line: number; character: number }

function surface(text: string): Surface | undefined {
  const lines = normalizeTableBorders(text).split(/\r?\n/);
  const horizontal: number[] = [];
  const columns = new Set<number>();
  lines.forEach((line, row) => {
    if (!/^[|+\-=_\s]+$/.test(line) || !/[-=_+]/.test(line)) return;
    horizontal.push(row);
    for (let column = 0; column < line.length; column++) if (/[|+]/.test(line[column])) columns.add(column);
  });
  const node = parseGeometricTable(text, false, true, true);
  if (!node.cells.length || horizontal.length < 2) return undefined;
  return { node, lines, horizontal, vertical: [...columns].sort((a, b) => a - b) };
}

function boundaries(line: string, columns: number[]): number[] {
  const pipes = [...line.matchAll(/\|/g)].map(match => match.index!);
  if (pipes.length < 2) return columns;
  return columns.map((column, index) => {
    if (index === 0) return pipes[0];
    if (index === columns.length - 1) return pipes[pipes.length - 1];
    const candidates = pipes.slice(1, -1);
    if (!candidates.length) return column;
    return candidates.reduce((best, candidate) =>
      Math.abs(candidate - column) < Math.abs(best - column) ? candidate : best, candidates[0]);
  });
}

function cellAt(table: Surface, point: Point): CellPoint | undefined {
  const row = table.horizontal.findIndex((border, index) => point.line > border && point.line < table.horizontal[index + 1]);
  if (row < 0) return undefined;
  const edges = boundaries(table.lines[point.line], table.vertical);
  const column = edges.findIndex((left, index) => point.character > left && point.character <= edges[index + 1]);
  const cell = table.node.cells.find(cell => row >= cell.row && row < cell.row + cell.rowspan &&
    column >= cell.column && column < cell.column + cell.colspan);
  if (!cell) return undefined;
  let line = 0;
  for (let r = table.horizontal[cell.row] + 1; r < point.line; r++) if (!table.horizontal.includes(r)) line++;
  return { cell, line, character: Math.max(0, point.character - edges[cell.column] - 2) };
}

/** Right separator of the cell containing a child, relative to this table. */
export function containingCellRight(text: string, point: Point): number | undefined {
  const parsed = surface(text);
  const target = parsed && cellAt(parsed, point);
  if (!parsed || !target) return undefined;
  return boundaries(parsed.lines[point.line], parsed.vertical)[target.cell.column + target.cell.colspan];
}

function pointAt(table: Surface, cell: TableCell, line: number, character: number): Point {
  let row = table.horizontal[cell.row] + 1;
  while (line > 0 && row < table.lines.length - 1) {
    row++;
    if (!table.horizontal.includes(row)) line--;
  }
  return { line: row, character: table.vertical[cell.column] + 2 + character };
}

function removeSiblingPadding(node: TableNode, cell: TableCell, removedLines: number) {
  if (removedLines <= 0) return;
  for (const other of node.cells) {
    if (other.id === cell.id || other.row !== cell.row || other.rowspan !== cell.rowspan) continue;
    let remaining = removedLines;
    while (remaining > 0 && other.content.length > 0 && !other.content[other.content.length - 1].trim()) {
      other.content.pop();
      remaining--;
    }
  }
}

function directBoxes(text: string): BoxRegion[] {
  const regions = findBoxRegions(text);
  return regions.filter(inner => !regions.some(outer => containsBox(outer, inner)));
}

function inBox(box: BoxRegion, point: Point): boolean {
  return point.line >= box.top && point.line <= box.bottom && point.character >= box.left && point.character <= box.right + 1;
}

function boxText(lines: string[], box: BoxRegion): string {
  return lines.slice(box.top, box.bottom + 1).map(line => line.slice(box.left, box.right + 1)).join('\n');
}

function replaceBox(lines: string[], box: BoxRegion, text: string): string[] {
  const replacement = text.split(/\r?\n/);
  const old = lines.slice(box.top, box.bottom + 1);
  const rows = Math.max(old.length, replacement.length);
  const result: string[] = [];
  for (let row = 0; row < rows; row++) {
    const source = old[row] || '';
    const before = source.slice(0, box.left).padEnd(box.left, ' ');
    const after = source.slice(box.right + 1).trimEnd();
    if (row < replacement.length) result.push(before + replacement[row] + after);
    else if (before.trim() || after.trim()) result.push(before + ' '.repeat(replacement[0].length) + after);
  }
  return [...lines.slice(0, box.top), ...result, ...lines.slice(box.bottom + 1)];
}

export function hasNestedTables(text: string): boolean {
  const parsed = surface(text);
  return !!parsed?.node.cells.some(cell => findBoxRegions(cell.content.join('\n')).length > 0);
}

export function tableBlockAt(lines: string[], point: Point): TableBlock | undefined {
  const isTableLine = (line: string) => /^\s*[-=_]?[|┌├└│]/.test(line);
  if (!lines[point.line] || !isTableLine(lines[point.line])) return undefined;
  let start = point.line;
  let end = start;
  while (start > 0 && isTableLine(lines[start - 1])) start--;
  while (end + 1 < lines.length && isTableLine(lines[end + 1])) end++;
  const text = lines.slice(start, end + 1).join('\n');
  const regions = findBoxRegions(text);
  const root = regions.find(region => region.left === 0 && point.line - start >= region.top &&
    point.line - start <= region.bottom && !regions.some(outer => containsBox(outer, region)));
  if (root) {
    end = start + root.bottom;
    start += root.top;
  }
  return { start, end, text: lines.slice(start, end + 1).join('\n'),
    cursor: { line: point.line - start, character: point.character } };
}

/** A child is opaque to its parent; only this function descends into it. */
export function formatNestedTable(text: string, trimPadding = false, preserveWidths = false): string {
  const parsed = surface(text);
  if (!parsed) return '';
  for (const cell of parsed.node.cells) {
    for (const box of directBoxes(cell.content.join('\n')).sort((a, b) => b.top - a.top || b.left - a.left)) {
      const child = formatNestedTable(boxText(cell.content, box), trimPadding, preserveWidths);
      if (child) cell.content = replaceBox(cell.content, box, child);
    }
    if (trimPadding) cell.content = cell.content.map(line => line.trim());
  }
  return formatBoxDrawingTable(parsed.node, preserveWidths);
}

export interface TableFocus {
  text: string;
  cursor: Point;
  toLocal: (point: Point) => Point | undefined;
  toGlobal: (point: Point) => Point;
  replace: (text: string, cursor: Point, preserveWidths?: boolean) => TableResult;
}

/** Locate the innermost table, retaining a path back through its parent cells. */
export function focusTable(text: string, cursor: Point): TableFocus {
  const identity: TableFocus = { text, cursor, toLocal: point => point, toGlobal: point => point,
    replace: (text, cursor) => ({ text, cursor }) };
  const parsed = surface(text);
  const target = parsed && cellAt(parsed, cursor);
  if (!parsed || !target) return identity;
  const box = directBoxes(target.cell.content.join('\n')).map(box => {
    let extra = 0;
    for (const row of [box.top, box.bottom]) {
      const marker = target.cell.content[row].slice(box.right + 1).match(/^[-=_]+/);
      if (marker) extra = Math.max(extra, marker[0].length);
    }
    return { ...box, right: box.right + extra };
  }).find(box => inBox(box, target));
  if (!box) return identity;
  const child = focusTable(boxText(target.cell.content, box), {
    line: target.line - box.top, character: target.character - box.left
  });
  return {
    text: child.text,
    cursor: child.cursor,
    toLocal(point) {
      const location = cellAt(parsed, point);
      if (!location || location.cell.id !== target.cell.id || !inBox(box, location)) return undefined;
      return child.toLocal({ line: location.line - box.top, character: location.character - box.left });
    },
    toGlobal(point) {
      const result = child.toGlobal(point);
      return pointAt(parsed, target.cell, box.top + result.line, box.left + result.character);
    },
    replace(text, cursor, preserveWidths = false) {
      const result = child.replace(text, cursor, preserveWidths);
      const oldHeight = target.cell.content.length;
      target.cell.content = replaceBox(target.cell.content, box, result.text);
      removeSiblingPadding(parsed.node, target.cell, oldHeight - target.cell.content.length);
      const formatted = formatBoxDrawingTable(parsed.node, preserveWidths);
      const next = surface(formatted)!;
      const cell = next.node.cells.find(cell => cell.id === target.cell.id)!;
      return { text: formatted, cursor: pointAt(next, cell, box.top + result.cursor.line, box.left + result.cursor.character) };
    }
  };
}

/** Replace cell content before drawing borders, so native paste/delete cannot
 * consume the containing table's separators when a child grows or shrinks. */
export function editNestedTable(text: string, start: Point, end: Point, inserted: string, preserveWidths?: boolean): TableResult | undefined {
  let focus = focusTable(text, start);
  let localEnd = focus.toLocal(end);
  if (!localEnd) {
    // A selection crossing a child boundary belongs to the containing cell.
    focus = { text, cursor: start, toLocal: point => point, toGlobal: point => point, replace: (text, cursor) => ({ text, cursor }) };
    localEnd = end;
  }
  const parsed = surface(focus.text);
  if (!parsed) return undefined;
  const from = cellAt(parsed, focus.cursor);
  const to = cellAt(parsed, localEnd);
  if (!from || !to || from.cell.id !== to.cell.id) return undefined;
  const content = from.cell.content;
  const before = (content[from.line] || '').padEnd(from.character, ' ').slice(0, from.character);
  const after = (content[to.line] || '').slice(to.character);
  const added = inserted.split(/\r?\n/);
  const replacement = (before + added.join('\n') + after).split('\n');
  content.splice(from.line, to.line - from.line + 1, ...replacement);
  removeSiblingPadding(parsed.node, from.cell, to.line - from.line + 1 - replacement.length);
  const line = from.line + added.length - 1;
  const character = added.length === 1 ? before.length + added[0].length : added[added.length - 1].length;
  const preserve = preserveWidths ?? (inserted.length > 0 && !inserted.includes('\n'));
  const formatted = formatBoxDrawingTable(parsed.node, preserve);
  const next = surface(formatted)!;
  const nextCell = next.node.cells.find(cell => cell.id === from.cell.id)!;
  return focus.replace(formatted, pointAt(next, nextCell, line, character), preserve);
}

/** Create an independent table inside a cell using the existing |RxC / |- syntax. */
export function nestedTableSeed(text: string, cursor: Point): TableFocus | undefined {
  const parent = focusTable(text, cursor);
  const parsed = surface(parent.text);
  const target = parsed && cellAt(parsed, parent.cursor);
  if (!parsed || !target) return undefined;
  const line = target.cell.content[target.line] || '';
  const match = line.match(/^(\s*)(\|\s*\d+\s*x\s*\d+|\|[-=_]+)\s*$/);
  if (!match) return undefined;
  const indent = match[1].length;
  return {
    text: match[2], cursor: { line: 0, character: Math.max(0, target.character - indent) },
    toLocal: () => undefined,
    toGlobal: point => parent.toGlobal(pointAt(parsed, target.cell, target.line + point.line, indent + point.character)),
    replace(text, cursor) {
      target.cell.content.splice(target.line, 1, ...text.split(/\r?\n/).map(line => match[1] + line));
      const formatted = formatBoxDrawingTable(parsed.node);
      const next = surface(formatted)!;
      const cell = next.node.cells.find(cell => cell.id === target.cell.id)!;
      return parent.replace(formatted, pointAt(next, cell, target.line + cursor.line, indent + cursor.character));
    }
  };
}

/** Select only the innermost cell's text, using original document coordinates. */
export function nestedCellRanges(text: string, cursor: Point): {start: Point; end: Point}[] {
  const focus = focusTable(text, cursor);
  const parsed = surface(focus.text);
  const target = parsed && cellAt(parsed, focus.cursor);
  if (!parsed || !target) return [];
  return target.cell.content.map((line, index) => {
    const leading = line.length - line.trimStart().length;
    const start = pointAt(parsed, target.cell, index, leading);
    const end = pointAt(parsed, target.cell, index, Math.max(leading, line.trimEnd().length));
    return {start: focus.toGlobal(start), end: focus.toGlobal(end)};
  });
}
