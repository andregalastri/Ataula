import { describe, expect, it } from 'vitest';
import type { Memento, TextDocument } from 'vscode';
import { PresentationWidths } from '../presentation-state';
import { extendTable } from '../table-finish';

const table = '┌───┐\n│ A │\n└───┘';
const result = extendTable(table, {line:1,character:3}, 80)!;
function document(name: string, scheme = 'file') {
  return {uri:{scheme, toString:() => scheme + ':' + name}} as TextDocument;
}
function storage() {
  const data: Record<string, unknown> = {};
  const state = {get:(key: string, fallback: unknown) => data[key] ?? fallback,
    update:async(key: string, value: unknown) => {data[key] = JSON.parse(JSON.stringify(value));}, keys:() => Object.keys(data)} as Memento;
  return {data,state};
}

describe('One-shot presentation state', () => {
  it('recognizes finalization after reopening the file and reloading the extension', async () => {
    const {state} = storage();
    await new PresentationWidths(state).add(document('/docs/one.txt'), result.expandedTable);
    const reloaded = new PresentationWidths(state);
    expect(reloaded.matching(document('/docs/one.txt'), result.text, result.cursor)).toEqual([result.expandedTable]);
  });

  it('does not apply another file’s presentation state or persist table contents', async () => {
    const {state,data} = storage();
    const widths = new PresentationWidths(state);
    await widths.add(document('/docs/one.txt'), result.expandedTable);
    expect(widths.matching(document('/docs/two.txt'), result.text, result.cursor)).toEqual([]);
    expect(JSON.stringify(data)).not.toContain(result.expandedTable);
    expect(JSON.stringify(data)).not.toContain('┌');
  });

  it('removes the pending reset after the next edit', async () => {
    const {state} = storage();
    const widths = new PresentationWidths(state);
    const doc = document('/docs/one.txt');
    await widths.add(doc, result.expandedTable);
    await widths.release(doc, [result.expandedTable]);
    expect(new PresentationWidths(state).matching(document('/docs/one.txt'), result.text, result.cursor)).toEqual([]);
  });

  it('supports untitled documents without saving their transient identity', async () => {
    const {state,data} = storage();
    const widths = new PresentationWidths(state);
    const doc = document('Untitled-1', 'untitled');
    await widths.add(doc, result.expandedTable);
    expect(widths.matching(doc, result.text, result.cursor)).toEqual([result.expandedTable]);
    expect(data).toEqual({});
  });
});
