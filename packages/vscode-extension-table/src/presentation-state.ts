import { createHash } from 'node:crypto';
import type { Memento, TextDocument } from 'vscode';
import type { Point } from './table-nesting';
import { presentationTablesAt } from './table-finish';

const storageKey = 'presentationWidths';
const digest = (text: string) => createHash('sha256').update(text).digest('hex');

/** Remember one-shot finalization across reopening, without storing cell text. */
export class PresentationWidths {
  private readonly documents = new WeakMap<TextDocument, Set<string>>();
  private readonly saved: Record<string, string[]>;

  constructor(private readonly storage: Memento) {
    this.saved = storage.get<Record<string, string[]>>(storageKey, {});
  }

  private marks(document: TextDocument): Set<string> {
    let marked = this.documents.get(document);
    if (!marked) {
      marked = new Set(this.saved[document.uri.toString()] || []);
      this.documents.set(document, marked);
    }
    return marked;
  }

  matching(document: TextDocument, text: string, cursor: Point): string[] {
    return presentationTablesAt(text, cursor, this.marks(document), digest);
  }

  async add(document: TextDocument, text: string): Promise<void> {
    this.marks(document).add(digest(text));
    await this.persist(document);
  }

  async release(document: TextDocument, tables: string[]): Promise<void> {
    if (!tables.length) return;
    const marked = this.marks(document);
    for (const table of tables) marked.delete(digest(table));
    await this.persist(document);
  }

  private async persist(document: TextDocument): Promise<void> {
    if (document.uri.scheme !== 'file') return;
    const key = document.uri.toString();
    const marked = this.marks(document);
    if (marked.size) this.saved[key] = [...marked];
    else delete this.saved[key];
    await this.storage.update(storageKey, { ...this.saved });
  }
}
