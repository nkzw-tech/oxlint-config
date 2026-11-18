import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('resolves forward declarations, local predicates and shadows independently in each file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'oxlint-bindings-'));
  try {
    const sameUses = [
      'export function accept(value: Input): Result { return value; }',
      'export type Bag = Record<string, Input>;',
      'export function local<Input, Result>(value: Input): Result { throw value; }',
    ];
    const files = {
      'broad.ts': [...sameUses, 'type Input = object;', 'type Result = unknown;'],
      'narrow.ts': [...sameUses, 'type Input = string;', 'type Result = number;'],
      'predicate.ts': [
        'const value = { name: "ok" };',
        'check(value);',
        'function check(input: unknown): input is string { return typeof input === "string"; }',
        'function nested(check: (input: object) => boolean) { return check(value); }',
        'const raw: unknown = value;',
        'export const cast = raw as string;',
        'function keep(raw: unknown) { return raw as string; }',
      ],
    };
    for (const [name, lines] of Object.entries(files)) {
      writeFileSync(join(dir, name), lines.join('\n'));
    }
    const config = {
      categories: { correctness: 'off' },
      jsPlugins: [
        {
          name: 'anti-slop',
          specifier: fileURLToPath(new URL('../anti-slop/index.js', import.meta.url)),
        },
      ],
      rules: Object.fromEntries(
        [
          'known-value-widening',
          'object-parameters',
          'unknown-returns',
          'unknown-type-aliases',
          'unsafe-dictionary-type',
          'widen-then-assert',
        ].map((name) => ['anti-slop/no-' + name, 'error']),
      ),
    };
    writeFileSync(join(dir, 'config.json'), JSON.stringify(config));
    const cli = fileURLToPath(new URL('../bin/oxlint', import.meta.resolve('oxlint')));
    const result = spawnSync(
      process.execPath,
      [cli, '--threads=1', '-c', 'config.json', '--format=json', ...Object.keys(files)],
      { cwd: dir, encoding: 'utf8' },
    );
    expect(result.status, result.stderr).toBe(1);
    const { diagnostics, number_of_files } = JSON.parse(result.stdout);
    expect(number_of_files).toBe(3);
    expect(
      diagnostics.map((row) => [row.filename, row.labels[0].span.line, row.code].join(' ')).sort(),
    ).toEqual([
      'broad.ts 1 anti-slop(no-object-parameters)',
      'broad.ts 1 anti-slop(no-unknown-returns)',
      'broad.ts 2 anti-slop(no-unsafe-dictionary-type)',
      'broad.ts 5 anti-slop(no-unknown-type-aliases)',
      'predicate.ts 2 anti-slop(no-known-value-widening)',
      'predicate.ts 4 anti-slop(no-object-parameters)',
      'predicate.ts 5 anti-slop(no-known-value-widening)',
      'predicate.ts 6 anti-slop(no-widen-then-assert)',
    ]);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
});
