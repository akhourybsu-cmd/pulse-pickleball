import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

export function referenceUrls(source) {
  return [...new Set([...source.matchAll(/url:\s*'(https:\/\/[^']+)'/g)].map(match => match[1]))];
}

/** Public teaching pages only; this check never sends account credentials. */
export async function checkReference(url, fetchImpl = fetch) {
  try {
    const response = await fetchImpl(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'PULSE-reference-check/1.0' } });
    if (!response.ok) return { url, ok: false, reason: `HTTP ${response.status}` };
    const html = await response.text();
    const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
    if (/404|page not found|access denied|just a moment|sign in to continue/i.test(title)) return { url, ok: false, reason: `Unavailable page: ${title.trim()}` };
    return { url, ok: true };
  } catch (error) { return { url, ok: false, reason: error.message }; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const source = await readFile(new URL('../src/lib/skill/knowledge.ts', import.meta.url), 'utf8');
  const urls = referenceUrls(source);
  if (!urls.length) throw new Error('No assessment references found.');
  let failures = 0;
  for (let start = 0; start < urls.length; start += 3) {
    const results = await Promise.all(urls.slice(start, start + 3).map(url => checkReference(url)));
    for (const result of results) {
      console.log(`${result.ok ? 'OK' : 'FAIL'} ${result.url}${result.reason ? ` — ${result.reason}` : ''}`);
      if (!result.ok) failures++;
    }
  }
  console.log(`${urls.length - failures}/${urls.length} teaching references available.`);
  if (failures) process.exitCode = 1;
}
