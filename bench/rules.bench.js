import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, expect, test } from 'vitest';
import plugin from '../quality/index.js';

const examples = {
  'no-array-filter-map': 'const rows = [1, 2]; rows.filter(Boolean).map(String); rows.map(String);',
  'no-chained-type-assertions': 'const cast = input as unknown as number; Number(input);',
  'no-conditional-empty-object-spread': 'const record = { ...(input ? { input } : {}) };',
  'no-known-value-widening': 'const widened: unknown = { id: 1 }; const precise = { id: 1 };',
  'no-object-parameters': 'type Param = object; function take(value: Param) {}',
  'no-reduce-accumulator-copy': '[1, 2].reduce((acc, item) => acc.concat(item), []);',
  'no-reflect-apply': 'Reflect.apply(fn, input, []); fn.call(input);',
  'no-reflect-get': 'Reflect.get(input, "id"); input.id;',
  'no-unknown-returns': 'function load(): Promise<Result> { return input; } type Result = unknown;',
  'no-unknown-type-aliases': 'type Alias = Forward; type Forward = unknown;',
  'no-unsafe-dictionary-type': 'type Dict<T> = Record<string, T>; type Bad = Dict<unknown>;',
  'no-widen-then-assert':
    'const src = { id: 1 }; const raw: unknown = src; const value = raw as { id: number };',
};

const rules = Object.keys(plugin.rules);
const workspace = mkdtempSync(join(tmpdir(), 'oxlint-rules-bench-'));
const current = fileURLToPath(new URL('../quality/index.js', import.meta.url));
const oxlint = fileURLToPath(new URL('../bin/oxlint', import.meta.resolve('oxlint')));
const repetitions = 256;
const samples = { iterations: 7, time: 0, warmupIterations: 2, warmupTime: 0 };

afterAll(() => rmSync(workspace, { force: true, recursive: true }));

function run(config, file, verify) {
  const args = [oxlint, '--threads=1', '--disable-nested-config', '-c', config];
  args.push(...(verify ? ['--format=json'] : ['--silent']), file);
  const result = spawnSync(process.execPath, args, {
    cwd: workspace,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    stdio: ['ignore', verify ? 'pipe' : 'ignore', 'pipe'],
  });
  if (result.error || (result.status !== 0 && result.status !== 1) || result.stderr) {
    throw new Error(result.error?.message ?? (result.stderr || 'Oxlint failed'));
  }
  if (verify) {
    const { diagnostics, number_of_files } = JSON.parse(result.stdout);
    expect(number_of_files).toBe(1);
    return diagnostics.map((diagnostic) => JSON.stringify(diagnostic)).sort();
  }
}

function benchmark(name, source, enabled, expected, size = repetitions) {
  test(name, { timeout: 120_000 }, async ({ bench }) => {
    const file = join(workspace, name + '.ts');
    writeFileSync(
      file,
      Array.from(
        { length: size },
        (_, i) => `export function work${i}(input) { ${source} }\n`,
      ).join(''),
    );
    const variants = [['current', current]];
    if (process.env.BENCH_BASELINE_PLUGIN) {
      variants.unshift(['baseline', process.env.BENCH_BASELINE_PLUGIN]);
    }
    const tasks = [];
    let reference;
    for (const [label, specifier] of variants) {
      const config = join(workspace, name + '-' + label + '.json');
      writeFileSync(
        config,
        JSON.stringify({
          categories: { correctness: 'off' },
          jsPlugins: [{ name: 'quality', specifier }],
          rules: Object.fromEntries(enabled.map((rule) => ['quality/' + rule, 'error'])),
        }),
      );
      const diagnostics = run(config, file, true);
      if (expected !== undefined) {
        expect(diagnostics).toHaveLength(expected);
      }
      if (reference) {
        expect(diagnostics).toEqual(reference);
      }
      reference = diagnostics;
      tasks.push(bench(label, () => run(config, file, false)));
    }
    await bench.compare(...tasks, samples);
  });
}

for (const [rule, source] of Object.entries(examples)) {
  benchmark(rule, source, [rule], repetitions * (rule === 'no-unknown-type-aliases' ? 2 : 1));
}
benchmark(
  'mixed',
  Object.values(examples)
    .map((source) => '{' + source + '}')
    .join('\n'),
  rules,
  repetitions * 16,
);
benchmark('no-findings', 'const rows = [input.id]; return rows.map(String).join(",");', rules, 0);

benchmark(
  'large-assertion-file',
  examples['no-widen-then-assert'],
  ['no-widen-then-assert'],
  2048,
  2048,
);
