import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

async function settle() {
  await new Promise(resolve => setTimeout(resolve, 300));
}

async function open(content: string, language = 'markdown') {
  const document = await vscode.workspace.openTextDocument({ content, language });
  const editor = await vscode.window.showTextDocument(document);
  const extension = vscode.extensions.getExtension('andregalastri.ataula-personal');
  assert.ok(extension, 'Galastri Ataula is not installed in the test host');
  await extension.activate();
  await settle();
  return editor;
}

function cursor(editor: vscode.TextEditor, line: number, character: number) {
  const position = new vscode.Position(line, character);
  editor.selection = new vscode.Selection(position, position);
}

async function format(editor: vscode.TextEditor) {
  const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>(
    'vscode.executeFormatDocumentProvider', editor.document.uri,
    { tabSize: 2, insertSpaces: true }
  );
  assert.ok(edits?.length);
  const edit = new vscode.WorkspaceEdit();
  edit.set(editor.document.uri, edits);
  assert.equal(await vscode.workspace.applyEdit(edit), true);
  await settle();
}

function box(lines: string[]): string {
  const width = Math.max(1, ...lines.map(line => line.length)) + 2;
  return ['┌' + '─'.repeat(width) + '┐', ...lines.map(line => '│ ' + line.padEnd(width - 2) + ' │'), '└' + '─'.repeat(width) + '┘'].join('\n');
}
const innerBox = '┌───┬───┐\n│ A │ B │\n└───┴───┘';
function nestedBox(inner = innerBox) { return box(['Before', '', ...inner.split('\n'), '', 'After']); }
function cursorAt(editor: vscode.TextEditor, text: string, offset: number) {
  const lines = editor.document.getText().split(/\r?\n/);
  const line = lines.findIndex(line => line.includes(text));
  assert.ok(line >= 0, `Missing ${text}`);
  cursor(editor, line, lines[line].indexOf(text) + offset);
}

suite('Galastri Ataula in the VS Code extension host', () => {
  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    await settle();
  });

  test('creates an empty table using the original command', async () => {
    const editor = await open('|2x2');
    cursor(editor, 0, 4);
    await vscode.commands.executeCommand('ataula.tableTab');
    await settle();
    let eol = '\n';
    if (editor.document.eol === vscode.EndOfLine.CRLF) eol = '\r\n';
    assert.equal(editor.document.getText(), [
      '┌───┬───┐', '│   │   │', '├───┼───┤', '│   │   │', '└───┴───┘'
    ].join(eol));
    assert.equal(editor.selection.active.line, 1);
    assert.equal(editor.selection.active.character, 2);
  });

  test('types in a Unicode table and keeps the adjacent cell', async () => {
    const editor = await open('┌───┬───┐\n│ A │ B │\n└───┴───┘');
    cursor(editor, 1, 3);
    await settle();
    await vscode.commands.executeCommand('type', { text: 'long' });
    await settle();
    assert.equal(editor.document.getText(), '┌───────┬───┐\n│ Along │ B │\n└───────┴───┘');
    assert.equal(editor.selection.active.character, 7);
  });

  test('Enter inserts a physical line inside the cell', async () => {
    const editor = await open('┌────┬───┐\n│ AB │ C │\n└────┴───┘');
    cursor(editor, 1, 3);
    await settle();
    await vscode.commands.executeCommand('ataula.tableEnter');
    await settle();
    assert.equal(editor.document.getText(), '┌───┬───┐\n│ A │ C │\n│ B │   │\n└───┴───┘');
    assert.equal(editor.selection.active.line, 2);
    assert.equal(editor.selection.active.character, 2);
  });

  test('keeps split content after Enter followed by another edit', async () => {
    const editor = await open('┌────┬───┐\n│ AB │ C │\n└────┴───┘');
    cursor(editor, 1, 3);
    await vscode.commands.executeCommand('ataula.tableEnter');
    await settle();
    await vscode.commands.executeCommand('type', { text: 'X' });
    await settle();
    assert.equal(editor.document.getText(), '┌────┬───┐\n│ A  │ C │\n│ XB │   │\n└────┴───┘');
  });

  test('formats legacy ASCII and preserves punctuation in content', async () => {
    const editor = await open('|---------|\n| x-y | z |\n|---------|');
    await format(editor);
    assert.equal(editor.document.getText(), '┌─────────┐\n│ x-y | z │\n└─────────┘');
  });

  test('selects content from a rendered cell', async () => {
    const editor = await open('┌───────┐\n│ hello │\n└───────┘');
    cursor(editor, 1, 4);
    await settle();
    await vscode.commands.executeCommand('ataula.selectCellContent');
    await settle();
    const selected = editor.selections.map(selection => editor.document.getText(selection)).join('\n');
    assert.equal(selected.trim(), 'hello');
  });

  test('converts Markdown to Unicode and back to ordinary Markdown', async () => {
    const markdown = '| Name | Value |\n| --- | --- |\n| A | B |';
    const editor = await open(markdown);
    cursor(editor, 0, 2);
    await vscode.commands.executeCommand('ataula.convertToAtaula');
    await settle();
    assert.ok(editor.document.getText().startsWith('┌'));
    assert.ok(editor.document.getText().includes('│ Name'));
    cursor(editor, 1, 2);
    await settle();
    await vscode.commands.executeCommand('ataula.convertToMarkdown');
    await settle();
    assert.equal(editor.document.getText(), markdown);
  });

  test('adds a column to the rendered table with an ASCII layout marker', async () => {
    const editor = await open('┌───┐-\n│ A │\n└───┘');
    cursor(editor, 0, 6);
    await vscode.commands.executeCommand('ataula.tableTab');
    await settle();
    assert.equal(editor.document.getText(), '┌───┬───┐\n│ A │   │\n└───┴───┘');
  });

  test('formats merged cells and leaves surrounding code fences alone', async () => {
    const editor = await open('Before\n\x60\x60\x60text\n|-------|\n| Title |\n|---|---|\n| A | B |\n|---|---|\n\x60\x60\x60\nAfter');
    await format(editor);
    assert.equal(editor.document.getText(), 'Before\n\x60\x60\x60text\n┌───────┐\n│ Title │\n├───┬───┤\n│ A │ B │\n└───┴───┘\n\x60\x60\x60\nAfter');
  });
  test('native multiple cursors work outside tables', async () => {
    const editor = await open('one\ntwo\nthree');
    cursor(editor, 1, 1);
    await vscode.commands.executeCommand('editor.action.insertCursorAbove');
    await settle();
    assert.equal(editor.selections.length, 2);
    await vscode.commands.executeCommand('editor.action.insertCursorBelow');
    await settle();
    assert.ok(editor.selections.length >= 2);
    assert.ok(editor.selections.every(selection => selection.isEmpty));
  });

  test('native multiple cursors type inside a table without being collapsed', async () => {
    const editor = await open('┌───┐\n│ A │\n│ B │\n│ C │\n└───┘');
    cursor(editor, 2, 2);
    await vscode.commands.executeCommand('editor.action.insertCursorAbove');
    await settle();
    assert.equal(editor.selections.length, 2);
    // Insert a third native cursor and type at all positions at once.
    editor.selections = [1, 2, 3].map(line => new vscode.Selection(line, 2, line, 2));
    await settle();
    await vscode.commands.executeCommand('type', { text: 'X' });
    await settle();
    assert.equal(editor.selections.length, 3);
    assert.ok(editor.document.getText().includes('XA'));
    assert.ok(editor.document.getText().includes('XB'));
    assert.ok(editor.document.getText().includes('XC'));
    const commands = await vscode.commands.getCommands();
    assert.equal(commands.some(command => command.startsWith('ataula.cursor')), false);
  });

  test('native text selections replace the selected content when typing', async () => {
    const editor = await open('┌────┐\n│ AB │\n│ CD │\n└────┘');
    cursor(editor, 1, 2);
    await vscode.commands.executeCommand('cursorRightSelect');
    await vscode.commands.executeCommand('cursorRightSelect');
    await settle();
    assert.equal(editor.document.getText(editor.selection), 'AB');
    await vscode.commands.executeCommand('type', { text: 'X' });
    await settle();
    assert.equal(editor.document.getText(), '┌────┐\n│ X  │\n│ CD │\n└────┘');
  });

  test('ordinary Shift selection stays a single native selection', async () => {
    const editor = await open('┌────┐\n│ AB │\n│ CD │\n└────┘');
    cursor(editor, 1, 2);
    await vscode.commands.executeCommand('cursorDownSelect');
    await settle();
    assert.equal(editor.selections.length, 1);
    assert.equal(editor.selection.start.line, 1);
    assert.equal(editor.selection.end.line, 2);
  });

  for (const language of ['php', 'javascript', 'python']) {
    test('creates tables in ' + language + ' files', async () => {
      const editor = await open('|1x1', language);
      cursor(editor, 0, 4);
      await vscode.commands.executeCommand('ataula.tableTab');
      await settle();
      assert.equal(editor.document.lineAt(0).text, '┌───┐');
      assert.equal(editor.document.lineAt(1).text, '│   │');
    });
  }

  test('creates and edits a table inside a PHP documentation comment', async () => {
    const editor = await open('<?php\n/**\n * |2x2\n */\n$outside = 42;', 'php');
    cursor(editor, 2, 7);
    await vscode.commands.executeCommand('ataula.tableTab');
    await settle();
    assert.equal(editor.document.lineAt(2).text, ' * ┌───┬───┐');
    assert.equal(editor.document.lineAt(3).text, ' * │   │   │');
    assert.equal(editor.selection.active.character, 5);
    await vscode.commands.executeCommand('type', { text: 'hello' });
    await settle();
    assert.ok(editor.document.getText().includes(' * │ hello │   │'));
    assert.ok(editor.document.getText().endsWith(' */\n$outside = 42;'));
  });

  for (const prefix of [' * ', '> ', '> > ', '  // ']) {
    test('keeps prefix ' + JSON.stringify(prefix) + ' through typing, Enter and paste', async () => {
      const raw = '┌───┬───┐\n│ A │ B │\n└───┴───┘';
      const editor = await open(raw.split('\n').map(line => prefix + line).join('\n'));
      cursor(editor, 1, prefix.length + 3);
      await settle();
      await vscode.commands.executeCommand('type', { text: 'long' });
      await settle();
      assert.ok(editor.document.getText().includes(prefix + '│ Along │ B │'));
      assert.equal(editor.selection.active.character, prefix.length + 7);
      cursor(editor, 1, prefix.length + 3);
      await vscode.commands.executeCommand('ataula.tableEnter');
      await settle();
      assert.equal(editor.selection.active.line, 2);
      assert.equal(editor.selection.active.character, prefix.length + 2);
      assert.ok(editor.document.getText().split(/\r?\n/).every(line => line.startsWith(prefix)));
      await editor.edit(builder => builder.insert(editor.selection.active, 'x\ny'));
      await settle();
      assert.ok(editor.document.getText().split(/\r?\n/).every(line => line.startsWith(prefix)));
      assert.ok(editor.document.getText().includes('ylong'), editor.document.getText());
    });
  }

  test('rebuilds the current table from scratch without touching nearby code', async () => {
    const raw = ['<?php', '/*',
      ' * ┌───────┬────────────────────────────┐',
      ' * │ teste │ teste                      │',
      ' * ├───────┼────────────────────────────┤',
      ' * │       │    colei e ficou deslocado │',
      ' * └───────┴────────────────────────────┘',
      ' */', '$outside = 42;'].join('\n');
    const editor = await open(raw, 'php');
    cursor(editor, 5, 17);
    await vscode.commands.executeCommand('ataula.reformatTable');
    await settle();
    assert.equal(editor.document.lineAt(2).text, ' * ┌───────┬─────────────────────────┐');
    assert.equal(editor.document.lineAt(3).text, ' * │ teste │ teste                   │');
    assert.equal(editor.document.lineAt(5).text, ' * │       │ colei e ficou deslocado │');
    assert.ok(editor.document.getText().endsWith(' */\n$outside = 42;'));
  });

  test('rebuilds indented tables and is idempotent', async () => {
    const editor = await open('    ┌─────┐\n    │  A  │\n    └─────┘', 'javascript');
    cursor(editor, 1, 7);
    await vscode.commands.executeCommand('ataula.reformatTable');
    await settle();
    assert.equal(editor.document.getText(), '    ┌───┐\n    │ A │\n    └───┘');
    const once = editor.document.getText();
    await vscode.commands.executeCommand('ataula.reformatTable');
    await settle();
    assert.equal(editor.document.getText(), once);
  });

  test('converts a quoted Markdown table in both directions', async () => {
    const markdown = '> | Name | Value |\n> | --- | --- |\n> | A | B |';
    const editor = await open(markdown);
    cursor(editor, 0, 4);
    await vscode.commands.executeCommand('ataula.convertToAtaula');
    await settle();
    assert.ok(editor.document.getText().startsWith('> ┌'));
    cursor(editor, 1, 4);
    await vscode.commands.executeCommand('ataula.convertToMarkdown');
    await settle();
    assert.equal(editor.document.getText(), markdown);
  });

  test('formats a nested box without projecting its columns through the prose', async () => {
    const wide = nestedBox().split('\n').map(line => line.slice(0, -1) + (line.startsWith('│') ? '    │' : '────' + line.slice(-1))).join('\n');
    const editor = await open(wide);
    await format(editor);
    assert.equal(editor.document.getText(), nestedBox());
  });

  test('types inside the inner table and grows both boxes', async () => {
    const editor = await open(nestedBox());
    cursorAt(editor, '│ A │', 3);
    await settle();
    await vscode.commands.executeCommand('type', {text:'long'});
    await settle();
    assert.equal(editor.document.getText(), nestedBox('┌───────┬───┐\n│ Along │ B │\n└───────┴───┘'));
    assert.equal(editor.document.lineAt(editor.selection.active.line).text.slice(0, editor.selection.active.character).endsWith('Along'), true);
  });

  test('Enter inside a child keeps its sibling cell and the outer prose', async () => {
    const editor = await open(nestedBox());
    cursorAt(editor, '│ A │', 3);
    await settle();
    await vscode.commands.executeCommand('ataula.tableEnter');
    await settle();
    await vscode.commands.executeCommand('type', {text:'X'});
    await settle();
    assert.equal(editor.document.getText(), nestedBox('┌───┬───┐\n│ A │ B │\n│ X │   │\n└───┴───┘'));
  });

  test('native multiline paste inside a child preserves all enclosing borders', async () => {
    const editor = await open(nestedBox());
    cursorAt(editor, '│ A │', 3);
    await settle();
    await editor.edit(builder => builder.insert(editor.selection.active, 'long\nX'));
    await settle();
    assert.equal(editor.document.getText(), nestedBox('┌───────┬───┐\n│ Along │ B │\n│ X     │   │\n└───────┴───┘'));
  });

  test('Backspace in a child shrinks all enclosing boxes', async () => {
    const editor = await open(nestedBox('┌────┬───┐\n│ AX │ B │\n└────┴───┘'));
    cursorAt(editor, 'AX', 2);
    await settle();
    await vscode.commands.executeCommand('deleteLeft');
    await settle();
    assert.equal(editor.document.getText(), nestedBox());
  });

  test('replaces a selected word inside a nested cell', async () => {
    const editor = await open(nestedBox('┌────┬───┐\n│ AX │ B │\n└────┴───┘'));
    cursorAt(editor, 'AX', 0);
    const start = editor.selection.active;
    editor.selection = new vscode.Selection(start, start.translate(0, 2));
    await settle();
    await vscode.commands.executeCommand('type', {text:'Z'});
    await settle();
    assert.ok(editor.document.getText().includes('│ Z'));
    assert.ok(editor.document.getText().includes('│ B │'));
    assert.ok(editor.document.getText().includes('After'));
  });

  test('creates a child from |2x2 without subdividing the enclosing box', async () => {
    const editor = await open(box(['Before', '|2x2', 'After']));
    cursorAt(editor, '|2x2', 4);
    await settle();
    await vscode.commands.executeCommand('ataula.tableTab');
    await settle();
    const child = '┌───┬───┐\n│   │   │\n├───┼───┤\n│   │   │\n└───┴───┘';
    assert.equal(editor.document.getText(), box(['Before', ...child.split('\n'), 'After']));
    await vscode.commands.executeCommand('type', {text:'X'});
    await settle();
    assert.ok(editor.document.getText().includes('│ │ X │   │ │'));
  });

  test('reformats inner padding while preserving the surrounding block', async () => {
    const padded = '┌─────┬─────┐\n│   A │   B │\n└─────┴─────┘';
    const editor = await open(nestedBox(padded));
    cursorAt(editor, '   A', 3);
    await settle();
    await vscode.commands.executeCommand('ataula.reformatTable');
    await settle();
    assert.equal(editor.document.getText(), nestedBox());
  });

  test('supports three nested levels inside a block comment', async () => {
    const content = ['/*', ...box(['Level 1', ...nestedBox().split('\n'), 'End']).split('\n').map(line => ' * ' + line), ' */'].join('\n');
    const editor = await open(content, 'php');
    cursorAt(editor, '│ A │', 3);
    await settle();
    await vscode.commands.executeCommand('type', {text:'Z'});
    await settle();
    const expected = ['/*', ...box(['Level 1', ...nestedBox('┌────┬───┐\n│ AZ │ B │\n└────┴───┘').split('\n'), 'End']).split('\n').map(line => ' * ' + line), ' */'].join('\n');
    assert.equal(editor.document.getText(), expected);
  });

  test('keeps native multiple cursors in nested tables', async () => {
    const editor = await open(nestedBox());
    cursorAt(editor, '│ A │', 2);
    const first = editor.selection.active;
    editor.selections = [new vscode.Selection(first, first), new vscode.Selection(first.translate(0, 4), first.translate(0, 4))];
    await settle();
    await vscode.commands.executeCommand('type', {text:'X'});
    await settle();
    assert.equal(editor.selections.length, 2);
    assert.ok(editor.document.getText().includes('XA'));
    assert.ok(editor.document.getText().includes('XB'));
  });

  test('selects the innermost cell content', async () => {
    const editor = await open(nestedBox());
    cursorAt(editor, '│ A │', 3);
    await settle();
    await vscode.commands.executeCommand('ataula.selectCellContent');
    await settle();
    assert.equal(editor.selections.map(selection => editor.document.getText(selection)).join('\n'), 'A');
  });

  test('uses the existing layout marker to add a column only to the child', async () => {
    const editor = await open(nestedBox(innerBox.replace('┐', '┐-')));
    cursorAt(editor, '┐-', 2);
    await settle();
    await vscode.commands.executeCommand('ataula.tableTab');
    await settle();
    assert.equal(editor.document.getText(), nestedBox('┌───┬───┬───┐\n│ A │ B │   │\n└───┴───┴───┘'));
  });

  test('replaces multiple lines inside a child without deleting its separators', async () => {
    const editor = await open(nestedBox('┌────┬───┐\n│ AX │ B │\n│ Y  │   │\n└────┴───┘'));
    cursorAt(editor, 'AX', 1);
    const start = editor.selection.active;
    cursorAt(editor, '│ Y', 2);
    editor.selection = new vscode.Selection(start, editor.selection.active);
    await settle();
    await vscode.commands.executeCommand('type', {text:'Z'});
    await settle();
    assert.equal(editor.document.getText(), nestedBox('┌─────┬───┐\n│ AZY │ B │\n└─────┴───┘'));
  });

  test('extends an indented table to column 80 without touching its content', async () => {
    const editor = await open(innerBox.split('\n').map(line => '   ' + line).join('\n'));
    cursorAt(editor, 'A', 1);
    await settle();
    const before = editor.selection.active;
    await vscode.commands.executeCommand('ataula.extendTable');
    await settle();
    const lines = editor.document.getText().split('\n');
    assert.ok(lines.every(line => line.length === 80));
    assert.equal(lines[0].indexOf('┬'), 7);
    assert.equal(lines[1].indexOf('A'), 5);
    assert.equal(lines[1].indexOf('B'), 9);
    assert.equal(editor.selection.active.character, before.character);
    assert.equal(editor.selection.active.line, before.line);
    const configuration = vscode.workspace.getConfiguration('galastriAtaula', editor.document.uri);
    await configuration.update('finishColumn', 96, vscode.ConfigurationTarget.Global);
    try {
      await vscode.commands.executeCommand('ataula.extendTable');
      await settle();
      assert.ok(editor.document.getText().split('\n').every(line => line.length === 96));
    } finally {
      await configuration.update('finishColumn', undefined, vscode.ConfigurationTarget.Global);
    }
  });

  test('counts comment prefixes in the presentation column', async () => {
    const editor = await open(['/*', ...innerBox.split('\n').map(line => ' * ' + line), ' */'].join('\n'), 'php');
    cursorAt(editor, 'A', 1);
    await settle();
    await vscode.commands.executeCommand('ataula.extendTable');
    await settle();
    assert.ok(editor.document.getText().split('\n').slice(1,-1).every(line => line.startsWith(' * ') && line.length === 80));
    assert.equal(editor.document.lineAt(0).text, '/*');
    assert.equal(editor.document.lineAt(4).text, ' */');
  });

  test('returns to normal widths on the first typing after finalization', async () => {
    const editor = await open(innerBox);
    cursorAt(editor, 'A', 1);
    await settle();
    await vscode.commands.executeCommand('ataula.extendTable');
    await settle();
    await vscode.commands.executeCommand('type', {text:'X'});
    await settle();
    assert.equal(editor.document.getText(), '┌────┬───┐\n│ AX │ B │\n└────┴───┘');
    await vscode.commands.executeCommand('type', {text:'Y'});
    await settle();
    assert.equal(editor.document.getText(), '┌─────┬───┐\n│ AXY │ B │\n└─────┴───┘');
  });

  test('resets presentation width after native multiline paste', async () => {
    const editor = await open(innerBox);
    cursorAt(editor, 'A', 1);
    await settle();
    await vscode.commands.executeCommand('ataula.extendTable');
    await settle();
    await editor.edit(builder => builder.insert(editor.selection.active, 'X\nY'));
    await settle();
    assert.equal(editor.document.getText(), '┌────┬───┐\n│ AX │ B │\n│ Y  │   │\n└────┴───┘');
  });

  test('resets presentation width after native Backspace', async () => {
    const editor = await open(innerBox);
    cursorAt(editor, 'A', 1);
    await settle();
    await vscode.commands.executeCommand('ataula.extendTable');
    await settle();
    await vscode.commands.executeCommand('deleteLeft');
    await settle();
    assert.equal(editor.document.getText(), '┌───┬───┐\n│   │ B │\n└───┴───┘');
  });

  test('resets presentation width after Enter while preserving the new content line', async () => {
    const editor = await open(innerBox);
    cursorAt(editor, 'A', 1);
    await settle();
    await vscode.commands.executeCommand('ataula.extendTable');
    await settle();
    await vscode.commands.executeCommand('ataula.tableEnter');
    await settle();
    assert.equal(editor.document.getText(), '┌───┬───┐\n│ A │ B │\n│   │   │\n└───┴───┘');
  });

  test('extends a child to its parent cell without growing the outer box', async () => {
    const source = nestedBox();
    const editor = await open(source);
    cursorAt(editor, 'Before', 3);
    await settle();
    await vscode.commands.executeCommand('ataula.extendTable');
    await settle();
    cursorAt(editor, '│ A │', 3);
    await settle();
    await vscode.commands.executeCommand('ataula.extendTable');
    await settle();
    const lines = editor.document.getText().split('\n');
    assert.ok(lines.every(line => line.length === 80));
    assert.ok(lines[3].endsWith('┐ │'));
    assert.ok(lines[4].endsWith('│ │'));
    await vscode.commands.executeCommand('type', {text:'X'});
    await settle();
    assert.equal(editor.document.getText(), nestedBox('┌────┬───┐\n│ AX │ B │\n└────┴───┘'));
  });

  test('keeps a finalized child usable after editing the surrounding prose', async () => {
    const source = box(['Heading with spare room', ...innerBox.split('\n')]);
    const editor = await open(source);
    cursorAt(editor, '│ A │', 3);
    await settle();
    await vscode.commands.executeCommand('ataula.extendTable');
    await settle();
    cursorAt(editor, 'Heading', 7);
    await settle();
    await vscode.commands.executeCommand('type', {text:'!'});
    await settle();
    cursorAt(editor, '│ A │', 3);
    await settle();
    await vscode.commands.executeCommand('type', {text:'X'});
    await settle();
    assert.equal(editor.document.getText(), box(['Heading! with spare room', ...'┌────┬───┐\n│ AX │ B │\n└────┴───┘'.split('\n')]));
  });

  test('ignores finalization outside tables and does not shrink a table beyond the target', async () => {
    const editor = await open('ordinary text');
    cursor(editor, 0, 3);
    await vscode.commands.executeCommand('ataula.extendTable');
    assert.equal(editor.document.getText(), 'ordinary text');
    const wide = box(['A'.repeat(85)]);
    await editor.edit(builder => builder.replace(new vscode.Range(0,0,0,editor.document.lineAt(0).text.length), wide));
    cursorAt(editor, 'AAAA', 3);
    await settle();
    await vscode.commands.executeCommand('ataula.extendTable');
    await settle();
    assert.equal(editor.document.getText(), wide);
  });

});
