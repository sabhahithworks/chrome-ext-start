import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

// The shadcn Alert is a grid whose first column is 0px wide without an icon, so anything not
// inside AlertTitle/AlertDescription (col-start-2) renders one word per line.
function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const path = join(dir, e.name);
    if (e.isDirectory()) return path.endsWith(join('components', 'ui')) ? [] : tsxFiles(path);
    return path.endsWith('.tsx') ? [path] : [];
  });
}

test('every Alert wraps its content in AlertTitle or AlertDescription', () => {
  const bare: string[] = [];
  let count = 0;
  for (const file of tsxFiles('src')) {
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/<Alert(?=[\s>])[^>]*>/g)) {
      count += 1;
      const rest = source.slice(m.index + m[0].length).trimStart();
      if (!/^<Alert(Title|Description)[\s>]/.test(rest)) {
        const line = source.slice(0, m.index).split('\n').length;
        bare.push(`${file}:${String(line)}`);
      }
    }
  }
  expect(count).toBeGreaterThan(10);
  expect(bare).toEqual([]);
});
