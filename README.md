# `@nkzw/oxlint-config`

_Opinionated Oxlint config with sensible defaults._

## Installation & Usage

### Standalone Oxlint

Install the preset with Oxlint 1.94+ and its type-aware backend, `tsrs`:

```
npm install -D @nkzw/oxlint-config oxlint tsrs
```

In your `oxlint.config.ts`:

```js
import nkzw from '@nkzw/oxlint-config';
import { defineConfig } from 'oxlint';

export default defineConfig({
  extends: [nkzw],
  env: nkzw.env,
});
```

Oxlint 1.94 reads `env` from the root config. Setting `env: nkzw.env` keeps the preset's browser and Node.js globals when using `extends`.

To include sorting, change the import to `@nkzw/oxlint-config/with-sorting`. Then run `pnpm oxlint` or `npx oxlint`.

In 3.0, both presets run type-aware rules and report unused lint suppressions as errors by default. If you already use Oxlint 1.94+ and only need the backend, run `npm install -D tsrs` or `pnpm add -D tsrs`.

### Vite+

Use a Vite+ release that includes Oxlint 1.94+ and `tsrs`, such as `vite-plus@1.7.0`. Add the preset to your project.

```sh
pnpm add -D @nkzw/oxlint-config
```

Import the Vite+ entry in your root `vite.config.ts` so TypeScript uses the lint types from your installed version of Vite+.

```ts
import nkzw from '@nkzw/oxlint-config/vite-plus';
import { defineConfig } from 'vite-plus';

export default defineConfig({ lint: nkzw });
```

Run `vp lint`. To enable sorting, import `@nkzw/oxlint-config/vite-plus/with-sorting`. See the [Vite+ lint guide](https://viteplus.dev/config/lint).

## Migrating to v3

1. Upgrade `@nkzw/oxlint-config` to v3, install Oxlint 1.94+ and `tsrs`, and switch your import to `@nkzw/oxlint-config/with-sorting` to keep v2’s sorting rules.
2. Run `pnpm oxlint`. In your project config, temporarily set each new rule that reports errors to `"off"`. Rerun lint and commit the passing upgrade.
3. Remove one `"off"` override and run lint. If the rule fits your project, fix every finding, rerun lint, and commit the change for that rule.
4. Repeat for each remaining override. Confirm with the project maintainers which rules, if any, should stay disabled.

## Philosophy & Principles

Use this configuration if these principles resonate with you:

- **Error, Never Warn:** Warnings are noise and get ignored. Either it's an issue, or it isn't. This config forces developers to fix problems or explicitly disable the rule with a comment.
- **Consistent code patterns:** Both presets enforce the same rules for correctness and code quality.
- **Prevent Bugs:** Problematic patterns such as `instanceof` are not allowed, forcing developers to choose more robust patterns. Debug-only code such as `console.log` or `test.only` are disallowed to avoid unintended logging in production or accidental CI failures.
- **Fast:** Slow rules are avoided. For example, TypeScript's `noUnusedLocals` check is preferred over `no-unused-vars`.
- **Don't get in the way:** [Subjective or overly opinionated rules](https://github.com/airbnb/javascript) (e.g. style preferences) are disabled. Autofixable rules are preferred to reduce friction and save time.
- **Optional sorting:** The `/with-sorting` preset also orders enums, interfaces, JSX props, object types, and object properties with [Perfectionist](https://perfectionist.dev/).

## Included Plugins & Rules

The preset includes 12 [quality rules](./quality/index.js) for TypeScript assertions and annotations, `Reflect.get` and `Reflect.apply`, array filtering and mapping, reducer copies, and conditional empty-object spreads. Use the `quality/` prefix in rule overrides and disable comments, for example `quality/no-array-filter-map`. These rules run with plain `oxlint`, alongside the built-in `oxc/no-accumulating-spread` rule.

This configuration consists of the most useful and least annoying rules from the following ESlint/Oxlint plugins:

- [`eslint-plugin-unicorn`](https://github.com/sindresorhus/eslint-plugin-unicorn)
- [`eslint-plugin-import-x`](https://github.com/un-ts/eslint-plugin-import-x)
- [`eslint-plugin-react`](https://github.com/jsx-eslint/eslint-plugin-react)
- [`eslint-plugin-react-hooks`](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks)
- [`eslint-plugin-no-instanceof`](https://www.npmjs.com/package/eslint-plugin-no-instanceof)
- [`eslint-plugin-no-only-tests`](https://github.com/levibuzolic/eslint-plugin-no-only-tests)

## Suggestions

This configuration is meant to be used with:

- [TypeScript](https://www.typescriptlang.org/) and the [`noUnusedLocals`](https://www.typescriptlang.org/tsconfig#noUnusedLocals) setting
- [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)

## Alternatives

If you are using ESLint, check out [`@nkzw/eslint-config`](https://github.com/nkzw-tech/eslint-config).
