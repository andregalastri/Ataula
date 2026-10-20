import { parseGeometricTable, formatBoxDrawingTable } from '@edumark/table-engine';

/** Explicitly rebuild widths and remove accidental padding inside cells. */
export function reformatTable(text: string): string {
  // In a rendered table, an ASCII pipe in a content row is literal text.
  // Protect it while the legacy parser works with structural ASCII pipes.
  let literalPipe = '\uE000';
  while (text.includes(literalPipe)) literalPipe = String.fromCharCode(literalPipe.charCodeAt(0) + 1);
  let input = text;
  if (/^[ \t]*[┌├└]/m.test(text)) {
    input = text.split('\n').map(line => {
      if (line.trimStart().startsWith('│')) return line.replace(/\|/g, literalPipe);
      return line;
    }).join('\n');
  }
  const table = parseGeometricTable(input, false, false, true);
  if (table.cells.length === 0) return '';
  for (const cell of table.cells) {
    cell.content = cell.content.map(line => line.replaceAll(literalPipe, '|').trim());
  }
  return formatBoxDrawingTable(table);
}
