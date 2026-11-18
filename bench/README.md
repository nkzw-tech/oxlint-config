# Quality rule benchmarks

Measured on an Apple M5 Max with Node 26.13.1, Oxlint 1.94.0, and Vitest 5.1.0. The baseline is the plugin from commit `9bfa545` (Git tree `60ce9277ca1a`). Both versions used the same Oxlint binary, rules, severities, and inputs.

## Repository runs

Median CLI wall time over 10 measured runs per version, with eight threads, a warm filesystem cache, a fresh process per run, and alternating version order. Inputs were tracked JavaScript and TypeScript files with each project's ignore patterns. The full-preset rows include the other plugins in this shared config. Every measured run matched the baseline's diagnostics, including messages and source locations.

| Project       | Files | Configuration    | Diagnostics |     Before |      After | Time saved |
| ------------- | ----: | ---------------- | ----------: | ---------: | ---------: | ---------: |
| Athena Crisis | 2,160 | 12 quality rules |         355 |   661.8 ms |   449.4 ms |      32.1% |
| Athena Crisis | 2,160 | Full preset      |         627 | 1,427.9 ms | 1,068.7 ms |      25.2% |
| Pocket Folio  |   166 | 12 quality rules |          24 |   187.5 ms |   162.1 ms |      13.5% |
| Pocket Folio  |   166 | Full preset      |          24 |   456.4 ms |   440.7 ms |       3.4% |

Oxlint's `--debug=timings` also measures time inside the rule callbacks. A separate single-thread run, using the median of five measured runs per version, went from **322.5 to 108.2 ms** in Athena Crisis and **37.2 to 14.0 ms** in Pocket Folio. CLI startup, parsing, and dispatch contribute to wall time outside those callbacks.

## Focused workloads

Mean CLI wall time over seven measured samples after two warm-ups per version. Each sample runs one Oxlint thread. Each isolated rule sees 256 functions. The mixed fixture runs all 12 rules and produces 4,096 diagnostics. The large assertion fixture exercises scope resolution in 2,048 functions. Small differences on short fixtures are comparable to process-startup variation.

| Workload                             |    Before |     After |
| ------------------------------------ | --------: | --------: |
| `no-array-filter-map`                | 105.60 ms | 105.78 ms |
| `no-chained-type-assertions`         | 101.03 ms | 100.37 ms |
| `no-conditional-empty-object-spread` | 100.52 ms | 100.99 ms |
| `no-known-value-widening`            | 102.82 ms | 101.53 ms |
| `no-object-parameters`               | 105.19 ms | 106.50 ms |
| `no-reduce-accumulator-copy`         | 107.61 ms | 106.41 ms |
| `no-reflect-apply`                   | 106.03 ms | 104.94 ms |
| `no-reflect-get`                     | 104.37 ms | 104.12 ms |
| `no-unknown-returns`                 | 106.06 ms | 103.51 ms |
| `no-unknown-type-aliases`            | 105.65 ms | 104.18 ms |
| `no-unsafe-dictionary-type`          | 109.33 ms | 105.07 ms |
| `no-widen-then-assert`               | 111.28 ms | 108.10 ms |
| `mixed`                              | 187.53 ms | 148.17 ms |
| `no-findings`                        | 107.77 ms | 104.74 ms |
| `large-assertion-file`               | 217.89 ms | 137.68 ms |

## Reproduce

Run `pnpm bench` for the focused suite. To compare revisions, extract the baseline plugin outside the checkout and pass its entry point to both benchmarks. The repository benchmark accepts a local Git checkout with its lint dependencies installed.

```sh
baseline_dir=$(mktemp -d)
git archive 60ce9277ca1a | tar -x -C "$baseline_dir"
BENCH_BASELINE_PLUGIN="$baseline_dir/index.js" pnpm bench
pnpm bench:project /path/to/project "$baseline_dir/index.js"
```
