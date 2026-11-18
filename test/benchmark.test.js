import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const vitest = fileURLToPath(new URL('./vitest.mjs', import.meta.resolve('vitest/package.json')));
const plugin = fileURLToPath(new URL('../quality/index.js', import.meta.url));

test.each([
  ['standalone', ''],
  ['comparison', plugin],
])(
  'runs a focused benchmark in %s mode',
  (_, baseline) => {
    const result = spawnSync(
      process.execPath,
      [
        vitest,
        'bench',
        '--run',
        '--reporter=verbose',
        'bench/rules.bench.js',
        '-t',
        '^no-findings$',
      ],
      {
        cwd: new URL('../', import.meta.url),
        encoding: 'utf8',
        env: { ...process.env, BENCH_BASELINE_PLUGIN: baseline },
        timeout: 30_000,
      },
    );
    expect(result.status, result.error?.message ?? result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('current');
    expect(result.stdout.includes('baseline')).toBe(Boolean(baseline));
  },
  35_000,
);
