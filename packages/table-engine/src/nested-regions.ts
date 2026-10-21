/** A closed, independent box. Coordinates use UTF-16 units, like VS Code. */
export interface BoxRegion {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export function findBoxRegions(text: string): BoxRegion[] {
  const lines = text.split(/\r?\n/);
  const regions: BoxRegion[] = [];
  for (let top = 0; top < lines.length; top++) {
    for (const match of lines[top].matchAll(/┌[─┬]+┐/g)) {
      const left = match.index!;
      const right = left + match[0].length - 1;
      for (let bottom = top + 1; bottom < lines.length; bottom++) {
        const edge = lines[bottom][left];
        if (edge === '└') {
          const end = lines[bottom].slice(left).match(/^└[─┴]+┘/);
          if (end && end[0].length === match[0].length) {
            regions.push({ top, bottom, left, right });
          }
          break;
        }
        // A box must have a continuous left edge. Adjacent/merged cells are
        // connected by junctions, whereas an independent child starts with ┌.
        if (edge !== '│' && edge !== '├') break;
      }
    }
  }
  return regions;
}

export function containsBox(outer: BoxRegion, inner: BoxRegion): boolean {
  return outer.top < inner.top && outer.bottom > inner.bottom &&
    outer.left < inner.left && outer.right > inner.right;
}

/** Hide child borders from the flat parser, without changing any offsets. */
export function protectNestedBoxes(text: string): { text: string; restore: (text: string) => string } {
  const regions = findBoxRegions(text);
  const sourceLines = text.split(/\r?\n/);
  const nested = regions.filter(inner => regions.some(outer => containsBox(outer, inner)) || (
    // The editor's logical view has already converted the parent's borders
    // to ASCII. Its children deliberately retain their Unicode glyphs.
    sourceLines.slice(0, inner.top).some(line => /^[|+\-=_\s]+$/.test(line) && line.includes('-')) &&
    sourceLines.slice(inner.bottom + 1).some(line => /^[|+\-=_\s]+$/.test(line) && line.includes('-')) &&
    sourceLines.slice(inner.top, inner.bottom + 1).every(line =>
      line.slice(0, inner.left).includes('|') && line.slice(inner.right + 1).includes('|'))
  ));
  if (!nested.length) return { text, restore: value => value };
  const glyphs = '─│┌┬┐├┼┤└┴┘|-+=_';
  let start = 0xE000;
  while (Array.from({ length: glyphs.length }, (_, i) => String.fromCharCode(start + i)).some(char => text.includes(char))) start += glyphs.length;
  const encode = new Map([...glyphs].map((char, index) => [char, String.fromCharCode(start + index)]));
  const decode = new Map([...encode].map(([char, token]) => [token, char]));
  const lines = text.split(/(\r?\n)/);
  for (const region of nested) {
    for (let row = region.top; row <= region.bottom; row++) {
      const index = row * 2;
      const line = lines[index];
      lines[index] = line.slice(0, region.left) + [...line.slice(region.left, region.right + 1)]
        .map(char => encode.get(char) || char).join('') + line.slice(region.right + 1);
    }
  }
  return { text: lines.join(''), restore: value => [...value].map(char => decode.get(char) || char).join('') };
}
