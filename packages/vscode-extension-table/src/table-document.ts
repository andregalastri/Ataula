import type * as vscode from 'vscode';
import { normalizeTableBorders } from '@edumark/table-engine';

// The editing engine keeps its original ASCII geometry. The real document
// always contains the rendered characters. Every replacement is one UTF-16
// unit wide, so selections, ranges and offsets retain their editor positions.
const documents = new WeakMap<vscode.TextDocument, vscode.TextDocument>();
const rawDocuments = new WeakMap<vscode.TextDocument, vscode.TextDocument>();
const editors = new WeakMap<vscode.TextEditor, vscode.TextEditor>();

export function getRawDocument(document: vscode.TextDocument): vscode.TextDocument {
  return rawDocuments.get(document) || document;
}

export function getTableDocument(document: vscode.TextDocument): vscode.TextDocument {
  if (rawDocuments.has(document)) return document;
  const existing = documents.get(document);
  if (existing) return existing;

  let cachedVersion = -1;
  let cachedText = '';
  let cachedLines: string[] = [];

  function refresh(): void {
    if (cachedVersion !== document.version) {
      cachedText = normalizeTableBorders(document.getText());
      cachedLines = cachedText.split(/\r\n|\r|\n/);
      cachedVersion = document.version;
    }
  }

  function getText(range?: vscode.Range): string {
    refresh();
    if (!range) return cachedText;
    const valid = document.validateRange(range);
    return cachedText.slice(document.offsetAt(valid.start), document.offsetAt(valid.end));
  }

  function lineAt(position: number | vscode.Position): vscode.TextLine {
    refresh();
    let number: number;
    if (typeof position === 'number') number = position;
    else number = position.line;
    const source = document.lineAt(number);

    function getLine(target: vscode.TextLine, property: string | symbol): unknown {
      if (property === 'text') return cachedLines[number];
      return Reflect.get(target, property, target);
    }

    return new Proxy({} as vscode.TextLine, {
      get(_target, property) { return getLine(source, property); }
    });
  }

  function get(target: vscode.TextDocument, property: string | symbol): unknown {
    if (property === 'getText') return getText;
    if (property === 'lineAt') return lineAt;
    const value = Reflect.get(target, property, target);
    if (typeof value === 'function') return value.bind(target);
    return value;
  }

  // VS Code freezes its API objects. Use a separate target so overridden
  // methods do not violate Proxy invariants on non-configurable properties.
  const proxy = new Proxy({} as vscode.TextDocument, {
    get(_target, property) { return get(document, property); }
  });
  documents.set(document, proxy);
  rawDocuments.set(proxy, document);
  return proxy;
}

export function getTableEditor(editor: vscode.TextEditor | undefined): vscode.TextEditor | undefined {
  if (!editor) return undefined;
  const existing = editors.get(editor);
  if (existing) return existing;

  function get(target: vscode.TextEditor, property: string | symbol): unknown {
    if (property === 'document') return getTableDocument(target.document);
    const value = Reflect.get(target, property, target);
    if (typeof value === 'function') return value.bind(target);
    return value;
  }

  function set(target: vscode.TextEditor, property: string | symbol, value: unknown): boolean {
    return Reflect.set(target, property, value, target);
  }

  const proxy = new Proxy({} as vscode.TextEditor, {
    get(_target, property) { return get(editor, property); },
    set(_target, property, value) { return set(editor, property, value); }
  });
  editors.set(editor, proxy);
  editors.set(proxy, proxy);
  return proxy;
}

export function getPhysicalTableText(document: vscode.TextDocument, start: number, end: number): string {
  const source = getRawDocument(document);
  const lines: string[] = [];
  for (let line = start; line <= end; line++) lines.push(source.lineAt(line).text);
  return lines.join('\n');
}
