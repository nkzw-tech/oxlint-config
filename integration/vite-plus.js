import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('Vite+ runs both packed presets with its own Oxlint and type-aware backend', (t) => {
  const cwd = mkdtempSync(join(tmpdir(), 'nkzw-vite-plus-'));
  t.after(() => rmSync(cwd, { force: true, recursive: true }));
  const pnpm = process.env.npm_execpath ?? 'pnpm';
  execFileSync(pnpm, ['pack', '--out', join(cwd, 'preset.tgz')], {
    cwd: new URL('../', import.meta.url),
  });
  writeFileSync(
    join(cwd, 'package.json'),
    JSON.stringify({
      devDependencies: {
        '@nkzw/oxlint-config': 'file:./preset.tgz',
        // The JavaScript plugins declare ESLint and TypeScript peers.
        eslint: '10.15.0',
        typescript: '6.0.3',
        'vite-plus': '1.7.0',
      },
      private: true,
      type: 'module',
    }),
  );
  writeFileSync(
    join(cwd, 'pnpm-workspace.yaml'),
    [
      'autoInstallPeers: false',
      'dedupePeerDependents: false',
      'hoist: false',
      'strictPeerDependencies: true',
    ].join('\n'),
  );
  execFileSync(pnpm, ['install', '--no-frozen-lockfile'], { cwd, stdio: 'inherit' });

  const project = createRequire(join(cwd, 'package.json'));
  const preset = createRequire(project.resolve('@nkzw/oxlint-config'));
  for (const consumer of [project, preset]) {
    for (const peer of ['oxlint', 'tsrs']) {
      assert.throws(() => consumer.resolve(peer + '/package.json'), { code: 'MODULE_NOT_FOUND' });
    }
  }

  writeFileSync(
    join(cwd, 'types.ts'),
    [
      "import base from '@nkzw/oxlint-config';",
      "import sorting from '@nkzw/oxlint-config/with-sorting';",
      'for (const preset of [base, sorting]) {',
      "  if (preset.rules) preset.rules['no-console'] = 'warn';",
      '}',
    ].join('\n'),
  );
  writeFileSync(
    join(cwd, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'nodenext',
        noEmit: true,
        skipLibCheck: false,
        strict: true,
        target: 'esnext',
      },
      files: ['input.ts', 'types.ts'],
    }),
  );
  writeFileSync(
    join(cwd, 'input.ts'),
    'export const order = { zebra: 1, apple: 2 };\nPromise.resolve(1);\n',
  );
  execFileSync(pnpm, ['exec', 'tsc'], { cwd, stdio: 'inherit' });

  for (const entry of ['@nkzw/oxlint-config', '@nkzw/oxlint-config/with-sorting']) {
    writeFileSync(
      join(cwd, 'vite.config.ts'),
      [
        `import preset from ${JSON.stringify(entry)};`,
        "import { defineConfig } from 'vite-plus';",
        'export default defineConfig({ lint: preset });',
      ].join('\n'),
    );
    const result = spawnSync(pnpm, ['exec', 'vp', 'lint', 'input.ts'], { cwd, encoding: 'utf8' });
    assert.ifError(result.error);
    const output = result.stdout + result.stderr;
    assert.equal(result.status, 1, output);
    assert.match(output, /typescript\(no-floating-promises\)/);
    assert.equal(
      output.includes('perfectionist(sort-objects)'),
      entry.endsWith('/with-sorting'),
      output,
    );
  }
});
