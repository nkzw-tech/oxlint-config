import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test.each(['@nkzw/oxlint-config', '@nkzw/oxlint-config/with-sorting'])(
  '%s runs typed rules and checks suppressions with plain Oxlint',
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
        `import preset from ${JSON.stringify(import.meta.resolve(preset))}; export default { extends: [preset] };`,
      );
      writeFileSync(join(cwd, 'tsconfig.json'), JSON.stringify({ files: ['input.ts'] }));
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
      const result = spawnSync(process.execPath, [cli, '--format=json', 'input.ts'], {
        cwd,
        encoding: 'utf8',
      });
      expect(result.status, result.stderr).toBe(1);
      const { diagnostics } = JSON.parse(result.stdout);
      expect(diagnostics).toHaveLength(2);
      expect(
        diagnostics.map(({ code, labels, message, severity }) => [
          labels[0].span.line,
          code ?? message,
          severity,
        ]),
      ).toEqual(
        expect.arrayContaining([
          [2, 'typescript(no-floating-promises)', 'error'],
          [5, expect.stringContaining('Unused oxlint-disable directive'), 'error'],
        ]),
      );
    } finally {
      rmSync(cwd, { force: true, recursive: true });
    }
  },
);
