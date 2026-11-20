import { readFile } from 'node:fs/promises';
import oxlint from 'oxlint/package.json' with { type: 'json' };
import { expect, test } from 'vitest';

const manifest = import.meta.resolve('oxlint/package.json');

test('ships the type declarations and license from the installed Oxlint version', async () => {
  const types = await readFile(new URL(oxlint.types, manifest), 'utf8');
  await expect(types).toMatchFileSnapshot('../types/oxlint.d.ts');

  const license = await readFile(new URL('LICENSE', manifest), 'utf8');
  await expect(license).toMatchFileSnapshot('../types/LICENSE');
});
