import * as vscode from 'vscode';
import { normalizeTableBorders } from '@edumark/table-engine';
import { splitTablePrefix } from './table-prefix';

interface Snapshot {
  version: number;
  text: string;
  lines: string[];
  prefixes: string[];
  physical: string[];
  starts: number[];
  eol: string;
}

const documents = new WeakMap<vscode.TextDocument, vscode.TextDocument>();
const rawDocuments = new WeakMap<vscode.TextDocument, vscode.TextDocument>();
const snapshots = new WeakMap<vscode.TextDocument, Snapshot>();
const editors = new WeakMap<vscode.TextEditor, vscode.TextEditor>();

export function getRawDocument(document: vscode.TextDocument): vscode.TextDocument {
  return rawDocuments.get(document) || document;
}

function snapshot(document: vscode.TextDocument): Snapshot {
  const raw = getRawDocument(document);
  const previous = snapshots.get(raw);
  if (previous && previous.version === raw.version) return previous;
  const source = raw.getText();
  const physical = source.split(/\r\n|\r|\n/);
  const parts = physical.map(splitTablePrefix);
  let eol = '\n';
  const match = source.match(/\r\n|\r|\n/);
  if (match) eol = match[0];
  else if (raw.eol === vscode.EndOfLine.CRLF) eol = '\r\n';
  const text = normalizeTableBorders(parts.map(part => part.text).join(eol));
  const lines = text.split(/\r\n|\r|\n/);
  const starts: number[] = [];
  let offset = 0;
  for (const line of lines) {
    starts.push(offset);
    offset += line.length + eol.length;
  }
  const current = { version: raw.version, text, lines, physical, starts, eol,
    prefixes: parts.map(part => part.prefix) };
  snapshots.set(raw, current);
  return current;
}

function logicalPosition(position: vscode.Position, data: Snapshot): vscode.Position {
  const prefix = data.prefixes[position.line] || '';
  if (!prefix) return position;
  return new vscode.Position(position.line, Math.max(0, position.character - prefix.length));
}

export function toEditorPosition(document: vscode.TextDocument, position: vscode.Position): vscode.Position {
  const prefix = snapshot(document).prefixes[position.line] || '';
  if (!prefix) return position;
  return new vscode.Position(position.line, position.character + prefix.length);
}

function toEditorRange(document: vscode.TextDocument, range: vscode.Range): vscode.Range {
  return new vscode.Range(toEditorPosition(document, range.start), toEditorPosition(document, range.end));
}

function offsetAt(position: vscode.Position, data: Snapshot): number {
  const line = Math.max(0, Math.min(position.line, data.lines.length - 1));
  return data.starts[line] + Math.max(0, Math.min(position.character, data.lines[line].length));
}

function mapSelection(selection: vscode.Selection, document: vscode.TextDocument, toPhysical: boolean): vscode.Selection {
  const data = snapshot(document);
  // Keep native identity for unprefixed documents and for selection mocks.
  if (!data.prefixes.some(Boolean)) return selection;
  let anchor: vscode.Position;
  let active: vscode.Position;
  if (toPhysical) {
    anchor = toEditorPosition(document, selection.anchor);
    active = toEditorPosition(document, selection.active);
  } else {
    anchor = logicalPosition(selection.anchor, data);
    active = logicalPosition(selection.active, data);
  }
  return new vscode.Selection(anchor, active);
}

/** Translate change coordinates using the snapshot from BEFORE the native edit. */
export function getTableChangeEvent(event: vscode.TextDocumentChangeEvent): vscode.TextDocumentChangeEvent {
  const raw = getRawDocument(event.document);
  const previous = snapshots.get(raw) || snapshot(raw);
  const contentChanges = event.contentChanges.map(change => {
    const range = new vscode.Range(logicalPosition(change.range.start, previous), logicalPosition(change.range.end, previous));
    return { ...change, range, rangeOffset: offsetAt(range.start, previous),
      rangeLength: offsetAt(range.end, previous) - offsetAt(range.start, previous) };
  });
  snapshot(raw);
  return { ...event, document: getTableDocument(raw), contentChanges };
}

export function getTableDocument(document: vscode.TextDocument): vscode.TextDocument {
  if (rawDocuments.has(document)) return document;
  const existing = documents.get(document);
  if (existing) return existing;
  snapshot(document);

  function get(_target: vscode.TextDocument, property: string | symbol): unknown {
    const data = snapshot(document);
    if (property === 'getText') return function (range?: vscode.Range) {
      const current = snapshot(document);
      if (!range) return current.text;
      return current.text.slice(offsetAt(range.start, current), offsetAt(range.end, current));
    };
    if (property === 'offsetAt') return function (position: vscode.Position) { return offsetAt(position, snapshot(document)); };
    if (property === 'positionAt') return function (offset: number) {
      const current = snapshot(document);
      const target = Math.max(0, Math.min(offset, current.text.length));
      let line = current.starts.length - 1;
      while (line > 0 && current.starts[line] > target) line--;
      return new vscode.Position(line, Math.min(target - current.starts[line], current.lines[line].length));
    };
    if (property === 'lineAt') return function (position: number | vscode.Position) {
      let number: number;
      if (typeof position === 'number') number = position;
      else number = position.line;
      const source = document.lineAt(number);
      const text = snapshot(document).lines[number];
      return new Proxy({} as vscode.TextLine, {
        get(_target, key) {
          if (key === 'text') return text;
          if (key === 'range') return new vscode.Range(new vscode.Position(number, 0), new vscode.Position(number, text.length));
          if (key === 'rangeIncludingLineBreak') {
            if (number + 1 < data.lines.length) return new vscode.Range(new vscode.Position(number, 0), new vscode.Position(number + 1, 0));
            return new vscode.Range(new vscode.Position(number, 0), new vscode.Position(number, text.length));
          }
          if (key === 'firstNonWhitespaceCharacterIndex') return text.length - text.trimStart().length;
          if (key === 'isEmptyOrWhitespace') return text.trim().length === 0;
          return Reflect.get(source, key, source);
        }
      });
    };
    const value = Reflect.get(document, property, document);
    if (typeof value === 'function') return value.bind(document);
    return value;
  }
  // VS Code freezes its API objects, so proxies must have independent targets.
  const proxy = new Proxy({} as vscode.TextDocument, { get });
  documents.set(document, proxy);
  rawDocuments.set(proxy, document);
  return proxy;
}

export function getTableEditor(editor: vscode.TextEditor | undefined): vscode.TextEditor | undefined {
  if (!editor) return undefined;
  const existing = editors.get(editor);
  if (existing) return existing;
  getTableDocument(editor.document);

  const proxy = new Proxy({} as vscode.TextEditor, {
    get(_target, property) {
      if (property === 'document') return getTableDocument(editor.document);
      if (property === 'selection') return mapSelection(editor.selection, editor.document, false);
      if (property === 'selections') {
        if (!snapshot(editor.document).prefixes.some(Boolean)) return editor.selections;
        return editor.selections.map(selection => mapSelection(selection, editor.document, false));
      }
      if (property === 'edit') return function (callback: (builder: vscode.TextEditorEdit) => void, options?: { undoStopBefore: boolean; undoStopAfter: boolean }) {
        return editor.edit(function (builder) {
          const logicalBuilder = new Proxy({} as vscode.TextEditorEdit, {
            get(_target, key) {
              if (key === 'replace') return function (range: vscode.Range, text: string) { builder.replace(toEditorRange(editor.document, range), text); };
              if (key === 'insert') return function (position: vscode.Position, text: string) { builder.insert(toEditorPosition(editor.document, position), text); };
              if (key === 'delete') return function (range: vscode.Range) { builder.delete(toEditorRange(editor.document, range)); };
              const value = Reflect.get(builder, key, builder);
              if (typeof value === 'function') return value.bind(builder);
              return value;
            }
          });
          callback(logicalBuilder);
        }, options);
      };
      const value = Reflect.get(editor, property, editor);
      if (typeof value === 'function') return value.bind(editor);
      return value;
    },
    set(_target, property, value) {
      if (property === 'selection') value = mapSelection(value, editor.document, true);
      if (property === 'selections' && snapshot(editor.document).prefixes.some(Boolean)) {
        value = value.map((selection: vscode.Selection) => mapSelection(selection, editor.document, true));
      }
      return Reflect.set(editor, property, value, editor);
    }
  });
  editors.set(editor, proxy);
  editors.set(proxy, proxy);
  return proxy;
}

/** Build a whole-table edit without discarding indentation/comment markers. */
export function createTableEdit(document: vscode.TextDocument, range: vscode.Range, text: string): vscode.TextEdit {
  const raw = getRawDocument(document);
  const prefix = snapshot(raw).prefixes[range.start.line] || '';
  const rendered = text.split(/\r\n|\r|\n/).map(line => prefix + line).join(snapshot(raw).eol);
  const physicalRange = new vscode.Range(new vscode.Position(range.start.line, 0),
    new vscode.Position(range.end.line, raw.lineAt(range.end.line).text.length));
  return vscode.TextEdit.replace(physicalRange, rendered);
}

export function replaceTable(edit: vscode.WorkspaceEdit, document: vscode.TextDocument, range: vscode.Range, text: string): void {
  const replacement = createTableEdit(document, range, text);
  edit.replace(document.uri, replacement.range, replacement.newText);
}

/** Physical border glyphs, with the surrounding language's prefixes removed. */
export function getPhysicalTableText(document: vscode.TextDocument, start: number, end: number): string {
  return snapshot(document).physical.slice(start, end + 1).map(line => splitTablePrefix(line).text).join('\n');
}
