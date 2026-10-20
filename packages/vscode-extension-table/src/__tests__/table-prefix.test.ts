import { describe, it, expect } from 'vitest';
import * as vscode from 'vscode';
import { splitTablePrefix } from '../table-prefix';
import { reformatTable } from '../table-reformat';
import { createTableEdit, getTableDocument, getTableEditor, getTableChangeEvent } from '../table-document';

function documentMock(initial: string) {
  let text = initial;
  let version = 1;
  return Object.freeze({
    get version() { return version; },
    get lineCount() { return text.split('\n').length; },
    getText() { return text; },
    lineAt(line: number) { return { text: text.split('\n')[line], lineNumber: line }; },
    update(next: string) { text = next; version++; }
  });
}

const table = '┌───┐\n│ A │\n└───┘';

describe('Tables inside quotes and comments', function () {
  for (const prefix of ['> ', '> > ', '  * ', '  // ', '# ', '-- ', '    ']) {
    it('preserves the ' + JSON.stringify(prefix) + ' prefix while rebuilding a table', function () {
      const text = table.split('\n').map(line => prefix + line).join('\n');
      const raw = documentMock('Before\n' + text + '\nAfter') as unknown as vscode.TextDocument;
      const view = getTableDocument(raw);
      expect(view.lineAt(2).text).toBe('| A |');
      const range = new vscode.Range(new vscode.Position(1, 0), new vscode.Position(3, 5));
      const edit = createTableEdit(view, range, '┌────┐\n│ AB │\n│ CD │\n└────┘');
      expect(edit.range.start.line).toBe(1);
      expect(edit.range.start.character).toBe(0);
      expect(edit.range.end.character).toBe(prefix.length + 5);
      expect(edit.newText.split('\n')).toEqual(['┌────┐', '│ AB │', '│ CD │', '└────┘'].map(line => prefix + line));
    });
  }

  it('does not strip a comment prefix from ordinary prose', function () {
    expect(splitTablePrefix('  * prose with │ inside')).toEqual({ prefix: '', text: '  * prose with │ inside' });
    expect(splitTablePrefix('const string = "|---|";').prefix).toBe('');
  });

  it('maps native and logical selections in both directions', function () {
    const raw = documentMock(table.split('\n').map(line => ' * ' + line).join('\n'));
    let selection = new vscode.Selection(new vscode.Position(1, 5), new vscode.Position(1, 6));
    const editor = Object.freeze({ document: raw, get selection() { return selection; },
      set selection(next: vscode.Selection) { selection = next; },
      get selections() { return [selection]; } }) as unknown as vscode.TextEditor;
    const view = getTableEditor(editor)!;
    expect(view.selection.anchor.character).toBe(2);
    expect(view.selection.active.character).toBe(3);
    view.selection = new vscode.Selection(new vscode.Position(1, 2), new vscode.Position(1, 2));
    expect(editor.selection.active.character).toBe(5);
  });

  it('translates change coordinates against the previous snapshot', function () {
    const raw = documentMock(' * ┌───┐\n * │ A │\n * └───┘');
    const document = raw as unknown as vscode.TextDocument;
    getTableDocument(document);
    raw.update(' * ┌───┐\n * │ AB │\n * └───┘');
    const native = { document, contentChanges: [{ range: new vscode.Range(new vscode.Position(1, 6), new vscode.Position(1, 6)),
      text: 'B', rangeLength: 0, rangeOffset: 15 }] } as vscode.TextDocumentChangeEvent;
    const event = getTableChangeEvent(native);
    expect(event.contentChanges[0].range.start.character).toBe(3);
    expect(event.contentChanges[0].rangeOffset).toBe(9);
    expect(event.document.lineAt(1).text).toBe('| AB |');
  });

  it('preserves CRLF when generating a prefixed edit', function () {
    const raw = documentMock('> ┌───┐\r\n> │ A │\r\n> └───┘') as unknown as vscode.TextDocument;
    const edit = createTableEdit(raw, new vscode.Range(new vscode.Position(0, 0), new vscode.Position(2, 5)), table);
    expect(edit.newText).toBe('> ┌───┐\r\n> │ A │\r\n> └───┘');
  });
});

describe('Explicit rebuild', function () {
  it('removes pasted indentation and recomputes widths without changing cells', function () {
    const raw = ['┌───────┬─────────────────────────────┐',
      '│ teste │ teste                      │',
      '├───────┼─────────────────────────────┤',
      '│       │    colei e ficou deslocado │',
      '└───────┴─────────────────────────────┘'].join('\n');
    const expected = ['┌───────┬─────────────────────────┐',
      '│ teste │ teste                   │',
      '├───────┼─────────────────────────┤',
      '│       │ colei e ficou deslocado │',
      '└───────┴─────────────────────────┘'].join('\n');
    expect(reformatTable(raw)).toBe(expected);
  });

  it('keeps merged cells and literal pipes while rebuilding', function () {
    const raw = '┌─────────┐\n│ x | y   │\n├───┬─────┤\n│ A │ B   │\n└───┴─────┘';
    expect(reformatTable(raw)).toContain('│ x | y │');
    expect(reformatTable(raw)).toContain('├───┬───┤');
  });
});
