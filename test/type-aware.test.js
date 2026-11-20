import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test.each(['@nkzw/oxlint-config', '@nkzw/oxlint-config/with-sorting'])(
  '%s uses root globals and inherits typed rules and suppression checks with extends',
  (preset) => {
    const cwd = mkdtempSync(join(tmpdir(), 'oxlint-type-aware-'));
    try {
      symlinkSync(
        new URL('../node_modules', import.meta.url),
        join(cwd, 'node_modules'),
        'junction',
      );
      writeFileSync(
        join(cwd, 'oxlint.config.ts'),
        [
          `import preset from ${JSON.stringify(import.meta.resolve(preset))};`,
          "import { defineConfig } from 'oxlint';",
          'export default defineConfig({ extends: [preset], env: preset.env });',
        ].join('\n'),
      );
      writeFileSync(join(cwd, 'tsconfig.json'), JSON.stringify({ files: ['input.ts'] }));
      writeFileSync(
        join(cwd, 'globals.js'),
        [
          'export const url = window.location.href;',
          'export const version = process.version;',
          'export const typo = unknownGlobal;',
        ].join('\n'),
      );
      writeFileSync(
        join(cwd, 'input.ts'),
        [
          'export function start() {',
          '  Promise.resolve(1);',
          '  // oxlint-disable-next-line typescript/no-floating-promises',
          '  Promise.resolve(2);',
          '  // oxlint-disable-next-line typescript/no-floating-promises',
          '  return 3;',
          '}',
        ].join('\n'),
      );
      const cli = fileURLToPath(new URL('../bin/oxlint', import.meta.resolve('oxlint')));
      const result = spawnSync(process.execPath, [cli, '--format=json', 'input.ts', 'globals.js'], {
        cwd,
        encoding: 'utf8',
      });
      expect(result.status, result.stderr).toBe(1);
      const { diagnostics } = JSON.parse(result.stdout);
      expect(diagnostics).toHaveLength(3);
      expect(
        diagnostics.map(({ code, filename, labels, message, severity }) => [
          filename,
          labels[0].span.line,
          code ?? message,
          severity,
        ]),
      ).toEqual(
        expect.arrayContaining([
          ['input.ts', 2, 'typescript(no-floating-promises)', 'error'],
          ['input.ts', 5, expect.stringContaining('Unused oxlint-disable directive'), 'error'],
          ['globals.js', 3, 'eslint(no-undef)', 'error'],
        ]),
      );
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  },
);
