/**
 * The product name is written in three unlinked places — the document
 * <title>, the og:title meta, and the home wordmark. A rename that lands in
 * only one of them leaves the browser tab disagreeing with the page it is
 * labelling, which nothing else in the suite would catch.
 */
import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import directorySource from '../directory/DirectoryView.tsx?raw';

/** Returns the one capture group of `pattern`, throwing if it does not match. */
function capture(source: string, pattern: RegExp): string {
  const match = source.match(pattern);
  if (!match) throw new Error(`no match for ${pattern}`);
  return match[1];
}

describe('product name', () => {
  it('reads the same in the tab, the share card, and on the home page', () => {
    const documentTitle = capture(indexHtml, /<title>([^<]+)<\/title>/);
    const ogTitle = capture(indexHtml, /<meta property="og:title" content="([^"]+)" \/>/);
    const wordmark = capture(
      directorySource,
      /<h1 className="rd-dir-wordmark">([^<]+)<\/h1>/,
    );
    expect(documentTitle).toBe('Responder Brief 2');
    expect(ogTitle).toBe(documentTitle);
    expect(wordmark).toBe(documentTitle);
  });
});
