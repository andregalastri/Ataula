import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';

async function settle() {
  await new Promise(resolve => setTimeout(resolve, 300));
}

async function open(content: string) {
  const document = await vscode.workspace.openTextDocument({ content, language: 'markdown' });
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

suite('Galastri Ataula in the VS Code extension host', () => {
  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await settle();
  });

  test('creates an empty table using the original command', async () => {
    const editor = await open('|2x2');
    cursor(editor, 0, 4);
    await vscode.commands.executeCommand('ataula.tableTab');
    await settle();
    assert.equal(editor.document.getText(), [
      '┌───┬───┐', '│   │   │', '├───┼───┤', '│   │   │', '└───┴───┘'
    ].join('\n'));
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
});
