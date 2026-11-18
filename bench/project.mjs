import { deepStrictEqual, ok } from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import preset from '../index.js';

const [project, baseline] = process.argv.slice(2);
if (!project || !baseline) {
  throw new Error('Usage: pnpm bench:project <project-directory> <baseline-plugin-entry>');
}
const cwd = resolve(project);
const oxlint = fileURLToPath(new URL('../bin/oxlint', import.meta.resolve('oxlint')));
const current = fileURLToPath(new URL('../anti-slop/index.js', import.meta.url));
const tracked = execFileSync('git', ['ls-files', '-z'], {
  cwd,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
const files = tracked
  .split('\0')
  .filter((file) => /\.(?:[cm]?[jt]s|[jt]sx)$/.test(file) && existsSync(join(cwd, file)));
const { ignorePatterns } = JSON.parse(
  execFileSync(process.execPath, [oxlint, '--print-config'], { cwd, encoding: 'utf8' }),
);
const tempDir = mkdtempSync(join(tmpdir(), 'oxlint-project-bench-'));

function configFor(mode, label, specifier) {
  const plugin = { name: 'anti-slop', specifier };
  const config =
    mode === 'rules'
      ? {
          categories: { correctness: 'off' },
          jsPlugins: [plugin],
          rules: Object.fromEntries(
            Object.entries(preset.rules).filter(([name]) => name.startsWith('anti-slop/')),
          ),
        }
      : {
          ...preset,
          jsPlugins: preset.jsPlugins.map((entry) => (entry.name === plugin.name ? plugin : entry)),
        };
  const file = join(tempDir, mode + '-' + label + '.json');
  writeFileSync(file, JSON.stringify({ ...config, ignorePatterns }));
  return file;
}

function measure(config) {
  const start = performance.now();
  const result = spawnSync(
    process.execPath,
    [
      oxlint,
      '--threads=8',
      '--disable-nested-config',
      '-c',
      config,
      '--format=json',
      '--',
      ...files,
    ],
    {
      cwd,
      encoding: 'utf8',
      maxBuffer: 128 * 1024 * 1024,
    },
  );
  const elapsed = performance.now() - start;
  if (result.error || (result.status !== 1 && result.status !== 0)) {
    throw result.error ?? new Error(result.stderr || result.stdout);
  }
  const { diagnostics, number_of_files: fileCount } = JSON.parse(result.stdout);
  ok(fileCount > 0, 'Expected a nonempty workload');
  return { diagnostics: diagnostics.map((row) => JSON.stringify(row)).sort(), elapsed, fileCount };
}

try {
  for (const mode of ['rules', 'preset']) {
    const baselineConfig = configFor(mode, 'baseline', resolve(baseline));
    const currentConfig = configFor(mode, 'current', current);
    const reference = measure(baselineConfig);
    const elapsed = new Map([
      [baselineConfig, []],
      [currentConfig, []],
    ]);
    for (let pair = 0; pair <= 10; pair++) {
      const order = pair % 2 ? [currentConfig, baselineConfig] : [baselineConfig, currentConfig];
      for (const config of order) {
        const run = measure(config);
        deepStrictEqual(run.fileCount, reference.fileCount);
        deepStrictEqual(run.diagnostics, reference.diagnostics);
        if (pair) {
          elapsed.get(config).push(run.elapsed);
        }
      }
    }
    for (const [config, label] of [
      [baselineConfig, 'baseline'],
      [currentConfig, 'current'],
    ]) {
      const times = elapsed.get(config).sort((left, right) => left - right);
      const median = (times[4] + times[5]) / 2;
      process.stdout.write(
        `${mode} ${label}: ${median.toFixed(1)} ms median (range ${times[0].toFixed(1)}–${times.at(-1).toFixed(1)}), ${reference.fileCount} files, ${reference.diagnostics.length} diagnostics\n`,
      );
    }
  }
} finally {
  rmSync(tempDir, { force: true, recursive: true });
}
