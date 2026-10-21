import { containsBox, findBoxRegions } from '@edumark/table-engine';
import type { BoxRegion } from '@edumark/table-engine';
import { containingCellRight } from './table-nesting';
import type { Point, TableResult } from './table-nesting';

export interface ExtendedTable extends TableResult { expandedTable: string }

function includes(region: BoxRegion, point: Point): boolean {
  return point.line >= region.top && point.line <= region.bottom &&
    point.character >= region.left && point.character <= region.right + 1;
}

function regionText(lines: string[], region: BoxRegion): string {
  return lines.slice(region.top, region.bottom + 1).map(line => line.slice(region.left, region.right + 1)).join('\n');
}

/** Append only padding and horizontal strokes. Never run the content formatter. */
export function extendTable(text: string, cursor: Point, finishColumn: number, prefixLength = 0): ExtendedTable | undefined {
  const lines = text.split(/\r?\n/);
  const regions = findBoxRegions(text);
  const target = regions.filter(region => includes(region, cursor))
    .sort((a, b) => (a.bottom - a.top) * (a.right - a.left) - (b.bottom - b.top) * (b.right - b.left))[0];
  if (!target || !Number.isSafeInteger(finishColumn) || finishColumn < 1) return undefined;
  const parent = regions.filter(region => containsBox(region, target))
    .sort((a, b) => (a.bottom - a.top) * (a.right - a.left) - (b.bottom - b.top) * (b.right - b.left))[0];
  let right = finishColumn - prefixLength - 1;
  if (parent) {
    const cellRight = containingCellRight(regionText(lines, parent), {
      line: target.top - parent.top, character: target.left - parent.left + 1
    });
    if (cellRight === undefined) return undefined;
    // Keep the containing cell's one-space padding after the child border.
    right = parent.left + cellRight - 2;
  }
  let extra = Math.max(0, right - target.right);
  for (let row = target.top; row <= target.bottom; row++) {
    if (!/[│┐┤┘]/.test(lines[row][target.right] || '')) return undefined;
    if (parent) {
      const padding = lines[row].slice(target.right + 1).match(/^ */)![0].length;
      // Text or another box following the child must never be overwritten.
      extra = Math.min(extra, Math.max(0, padding - 1));
    }
  }
  if (!extra) return undefined;
  for (let row = target.top; row <= target.bottom; row++) {
    const line = lines[row];
    const border = line[target.right];
    const fill = /[┐┤┘]/.test(border) ? '─' : ' ';
    lines[row] = line.slice(0, target.right) + fill.repeat(extra) + border +
      line.slice(target.right + 1 + (parent ? extra : 0));
  }
  const expanded = { ...target, right: target.right + extra };
  return {
    text: lines.join(text.includes('\r\n') ? '\r\n' : '\n'),
    cursor: { line: cursor.line, character: cursor.character + (cursor.character >= target.right ? extra : 0) },
    expandedTable: regionText(lines, expanded)
  };
}

/** Find finalized tables on the edit's containing path, including ancestors. */
export function presentationTablesAt(text: string, cursor: Point, marked: ReadonlySet<string>): string[] {
  if (!marked.size) return [];
  const lines = text.split(/\r?\n/);
  return findBoxRegions(text).filter(region => includes(region, cursor))
    .map(region => regionText(lines, region)).filter(table => marked.has(table));
}
