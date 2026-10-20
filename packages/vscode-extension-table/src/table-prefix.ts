/** Separate the surrounding language's comment/quote prefix from table text. */
export function splitTablePrefix(line: string): { prefix: string; text: string } {
  const match = line.match(/^([ \t]*(?:>[ \t]*)*(?:(?:\/\/+|\/\*+|\*|#|--)[ \t]*)?)([-=_]?\|.*|[┌├└│].*)$/);
  if (!match) return { prefix: '', text: line };
  return { prefix: match[1], text: match[2] };
}
