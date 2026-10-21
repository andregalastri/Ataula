import { protectNestedBoxes } from './nested-regions.js';

const tableLineStart = /^\s*[-=_]?[|┌├└│]/;
const boxBorderLine = /^[\s|+\-=_─│┌┬┐├┼┤└┴┘]+$/;
const boxJunctions = /[┌┬┐├┼┤└┴┘]/g;

/**
 * Build an ASCII editing view without changing UTF-16 offsets or line endings.
 * Only blocks with a border are considered tables. Horizontal glyphs in cell
 * text stay untouched; raw ASCII layout markers remain available while editing.
 */
function isUnicodeBorder(line: string): boolean {
  if (!boxBorderLine.test(line)) return false;
  const trimmed = line.trim();
  if (/^[┌├└]/.test(trimmed)) return true;
  return /^[│|][\s│|├┼┤─+\-=_]*$/.test(trimmed) && /[├┼┤]/.test(trimmed);
}

function boundaryColumns(line: string | undefined, side: 'up' | 'down'): number[] {
  const columns: number[] = [];
  if (!line) return columns;
  for (let column = 0; column < line.length; column++) {
    const char = line[column];
    let connects = char === '|' || char === '+';
    if (side === 'down' && /[┌┬┐├┼┤│]/.test(char)) connects = true;
    if (side === 'up' && /[└┴┘├┼┤│]/.test(char)) connects = true;
    if (connects) columns.push(column);
  }
  return columns;
}

export function normalizeTableBorders(text: string): string {
  const protectedBoxes = protectNestedBoxes(text);
  text = protectedBoxes.text;
  const parts = text.split(/(\r\n|\r|\n)/);
  const originals = parts.slice();
  let start = 0;
  while (start < parts.length) {
    if (!tableLineStart.test(parts[start])) {
      start += 2;
      continue;
    }
    let end = start;
    let hasUnicodeBorder = false;
    const borders: number[] = [];
    while (end < parts.length && tableLineStart.test(parts[end])) {
      const line = parts[end];
      if (isUnicodeBorder(line)) {
        hasUnicodeBorder = true;
        borders.push(end);
      } else if (boxBorderLine.test(line) && /[-=_]/.test(line)) {
        borders.push(end);
      }
      end += 2;
    }
    if (hasUnicodeBorder) {
      let aboveIndex = -1;
      let nextBorder = 0;
      for (let index = start; index < end; index += 2) {
        const original = parts[index];
        while (nextBorder < borders.length && borders[nextBorder] < index) nextBorder++;
        const isBorder = nextBorder < borders.length && borders[nextBorder] === index;
        if (isBorder) {
          parts[index] = original.replace(/─/g, '-').replace(boxJunctions, '|').replace(/│/g, '|');
          aboveIndex = index;
          continue;
        }

        let above;
        let below;
        if (aboveIndex !== -1) above = originals[aboveIndex];
        // Keep the original junction directions when reading neighboring borders.
        if (nextBorder < borders.length) below = originals[borders[nextBorder]];
        const expected = new Set(boundaryColumns(above, 'down'));
        for (const column of boundaryColumns(below, 'up')) expected.add(column);
        const positions: number[] = [];
        for (let column = 0; column < original.length; column++) {
          if (original[column] === '│') positions.push(column);
        }
        if (positions.length === 0) continue;
        const selected = new Set([positions[0], positions[positions.length - 1]]);
        const minimum = positions[0];
        const maximum = positions[positions.length - 1];
        for (const reference of expected) {
          if (reference <= minimum || reference >= maximum) continue;
          let closest = -1;
          let distance = Infinity;
          for (let p = 1; p < positions.length - 1; p++) {
            const candidate = positions[p];
            const difference = Math.abs(candidate - reference);
            if (difference < distance) {
              closest = candidate;
              distance = difference;
            }
          }
          if (closest !== -1) selected.add(closest);
        }
        const chars = original.split('');
        for (const column of selected) chars[column] = '|';
        parts[index] = chars.join('');
      }
    }
    start = end;
  }
  return protectedBoxes.restore(parts.join(''));
}

/**
 * Render only the positions emitted as borders by the formatter. A literal
 * hyphen, pipe or drawing glyph in a cell is never interpreted as a border.
 */
export function drawSimpleBorders(lines: string[], separators: number[][], borderRows: Set<number>): string {
  const verticals: Set<number>[] = [];
  for (let row = 0; row < lines.length; row++) {
    verticals.push(new Set(separators[row]));
  }
  const glyphs: Record<number, string> = {
    0: ' ', 1: '─', 2: '─', 3: '─',
    4: '│', 5: '┘', 6: '└', 7: '┴',
    8: '│', 9: '┐', 10: '┌', 11: '┬',
    12: '│', 13: '┤', 14: '├', 15: '┼'
  };
  const output: string[] = [];
  for (let row = 0; row < lines.length; row++) {
    const line = lines[row];
    const chars = line.split('');
    if (!borderRows.has(row)) {
      for (const column of verticals[row]) {
        chars[column] = '│';
      }
      output.push(chars.join(''));
      continue;
    }
    for (let column = 0; column < line.length; column++) {
      if (line[column] === '-') {
        chars[column] = '─';
        continue;
      }
      if (!verticals[row].has(column)) {
        continue;
      }
      let mask = 0;
      if (column > 0 && line[column - 1] === '-') mask |= 1;
      if (column + 1 < line.length && line[column + 1] === '-') mask |= 2;
      if (row > 0 && verticals[row - 1].has(column)) mask |= 4;
      if (row + 1 < lines.length && verticals[row + 1].has(column)) mask |= 8;
      chars[column] = glyphs[mask];
    }
    output.push(chars.join(''));
  }
  return output.join('\n');
}
