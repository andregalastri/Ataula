import { describe, it, expect } from 'vitest';
import type * as vscode from 'vscode';
import { getTableDocument, getTableEditor, getRawDocument, getPhysicalTableText } from '../table-document';
import { getCellAtPosition, getLineBoundaryPos } from '../table-geometry';

function documentMock(initial: string) {
  let text = initial;
  let version = 1;
  const doc = {
    get version() { return version; },
    languageId: 'markdown',
    uri: { fsPath: '/table.md' },
    get lineCount() { return text.split('\n').length; },
    getText() { return text; },
    lineAt(line: number) { return Object.freeze({ text: text.split('\n')[line], lineNumber: line }); },
    validateRange(range: vscode.Range) { return range; },
    offsetAt(position: vscode.Position) {
      const lines = text.split('\n');
      let offset = position.character;
      for (let line = 0; line < position.line; line++) offset += lines[line].length + 1;
      return offset;
    },
    update(next: string) { text = next; version++; }
  };
  return Object.freeze(doc);
}

describe('Editor document adapter', function () {
  it('keeps one stable document identity while refreshing after edits', function () {
    const source = documentMock('┌───┐\n│ A │\n└───┘');
    const raw = source as unknown as vscode.TextDocument;
    const view = getTableDocument(raw);
    expect(getTableDocument(raw)).toBe(view);
    expect(getTableDocument(view)).toBe(view);
    expect(getRawDocument(view)).toBe(raw);
    expect(view.lineAt(1).text).toBe('| A |');
    source.update('┌────┐\n│ AB │\n└────┘');
    expect(view.lineAt(1).text).toBe('| AB |');
    expect(source.getText()).toContain('│ AB │');
  });

  it('normalizes ranges without changing their positions', function () {
    const source = documentMock('┌───┐\n│ A │\n└───┘');
    const view = getTableDocument(source as unknown as vscode.TextDocument);
    const range = { start: { line: 1, character: 0 }, end: { line: 1, character: 5 } } as vscode.Range;
    expect(view.getText(range)).toBe('| A |');
    expect(getPhysicalTableText(view, 0, 2)).toBe(source.getText());
  });

  it('writes selections to the real editor', function () {
    const source = documentMock('┌───┐\n│ A │\n└───┘');
    let selected: vscode.Selection[] = [];
    const raw = Object.freeze({ document: source,
      get selections() { return selected; },
      set selections(value: vscode.Selection[]) { selected = value; }
    }) as unknown as vscode.TextEditor;
    const editor = getTableEditor(raw)!;
    const selections = [{ anchor: { line: 1, character: 2 } }] as unknown as vscode.Selection[];
    editor.selections = selections;
    expect(raw.selections).toBe(selections);
    expect(getTableEditor(raw)).toBe(editor);
    expect(editor.document).toBe(getTableDocument(raw.document));
    expect(getTableEditor(undefined)).toBe(undefined);
  });

  it('finds the correct cell and ignores literal pipes in its content', function () {
    const source = documentMock('┌───┬─────────┐\n│ A │ x-y | z │\n└───┴─────────┘');
    const cell = getCellAtPosition(source as unknown as vscode.TextDocument, { line: 1, character: 7 } as vscode.Position);
    expect(cell?.cell.column).toBe(1);
    expect(cell?.cell.content).toEqual(['x-y | z']);
    expect(getLineBoundaryPos('| A | x-y | z |', [0, 4, 14])).toEqual([0, 4, 14]);
  });

  it('does not map a content pipe over the outer border in a one-column table', function () {
    expect(getLineBoundaryPos('| x | y |', [0, 8])).toEqual([0, 8]);
  });
});
