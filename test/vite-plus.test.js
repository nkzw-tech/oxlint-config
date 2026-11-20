import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';

test('Vite+ runs both packed presets', { timeout: 120_000 }, ({ onTestFinished }) => {
  const cwd = mkdtempSync(join(tmpdir(), 'nkzw-vite-plus-'));
  onTestFinished(() => rmSync(cwd, { force: true, recursive: true }));
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
  const preset = createRequire(project.resolve('@nkzw/oxlint-config/vite-plus'));
  for (const consumer of [project, preset]) {
    for (const peer of ['oxlint', 'tsrs']) {
      expect(() => consumer.resolve(peer + '/package.json')).toThrow(
        expect.objectContaining({ code: 'MODULE_NOT_FOUND' }),
      );
    }
  }

  writeFileSync(
    join(cwd, 'types.ts'),
    [
      "import base from '@nkzw/oxlint-config/vite-plus';",
      "import sorting from '@nkzw/oxlint-config/vite-plus/with-sorting';",
      'for (const preset of [base, sorting]) {',
      '  if (!preset.rules) continue;',
      "  preset.rules['no-console'] = 'warn';",
      '  // @ts-expect-error Oxlint rejects unknown severities.',
      "  preset.rules['no-console'] = 'fatal';",
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
  writeFileSync(
    join(cwd, 'globals.js'),
    'export const globals = [window.location.href, process.version];\n',
  );
  execFileSync(pnpm, ['exec', 'tsc'], { cwd, stdio: 'inherit' });

  for (const [entry, lint] of [
    ['@nkzw/oxlint-config/vite-plus', 'preset'],
    ['@nkzw/oxlint-config/vite-plus/with-sorting', 'preset'],
    ['@nkzw/oxlint-config/vite-plus', '{ extends: [preset], env: preset.env }'],
  ]) {
    writeFileSync(
      join(cwd, 'vite.config.ts'),
      [
        `import preset from ${JSON.stringify(entry)};`,
        "import { defineConfig } from 'vite-plus';",
        `export default defineConfig({ lint: ${lint} });`,
      ].join('\n'),
    );
    const result = spawnSync(pnpm, ['exec', 'vp', 'lint', 'input.ts', 'globals.js'], {
      cwd,
      encoding: 'utf8',
    });
    expect(result.error).toBeUndefined();
    const output = result.stdout + result.stderr;
    expect(result.status, output).toBe(1);
    expect(output).toContain('typescript(no-floating-promises)');
    expect(output).not.toContain('eslint(no-undef)');
    expect(output.includes('perfectionist(sort-objects)'), output).toBe(
      entry.endsWith('/with-sorting'),
    );
  }
});
