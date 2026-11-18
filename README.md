# `@nkzw/oxlint-config`

_Opinionated Oxlint config with sensible defaults._

## Installation & Usage

With Oxlint v1.90+:

```
npm install -D @nkzw/oxlint-config @nkzw/eslint-plugin
```

In your `oxlint.config.ts`:

```js
import nkzw from '@nkzw/oxlint-config';
import { defineConfig } from 'oxlint';

export default defineConfig({
  extends: [nkzw],
});
```

Then run `pnpm oxlint` or `npm oxlint`.

To run the preset’s type-aware rules with Oxlint 1.94+, install `tsrs` as a dev dependency and run `pnpm oxlint --type-aware`, or set `options: { typeAware: true }` in your Oxlint config. The preset checks for floating promises in TypeScript files.

## Philosophy & Principles

Use this configuration if these principles resonate with you:

- **Error, Never Warn:** Warnings are noise and get ignored. Either it's an issue, or it isn't. This config forces developers to fix problems or explicitly disable the rule with a comment.
- **Strict, Consistent Code Style:** When multiple approaches exist, this configuration enforces the strictest, most consistent code style, preferring modern language features and best practices.
- **Prevent Bugs:** Problematic patterns such as `instanceof` are not allowed, forcing developers to choose more robust patterns. Debug-only code such as `console.log` or `test.only` are disallowed to avoid unintended logging in production or accidental CI failures.
- **Fast:** Slow rules are avoided. For example, TypeScript's `noUnusedLocals` check is preferred over `no-unused-vars`.
- **Don't get in the way:** [Subjective or overly opinionated rules](https://github.com/airbnb/javascript) (e.g. style preferences) are disabled. Autofixable rules are preferred to reduce friction and save time.

## Included Plugins & Rules

The preset includes 12 [quality rules](./quality/index.js) for TypeScript assertions and annotations, `Reflect.get` and `Reflect.apply`, array filtering and mapping, reducer copies, and conditional empty-object spreads. Use the `quality/` prefix in rule overrides and disable comments, for example `quality/no-array-filter-map`. These rules run with plain `oxlint`, alongside the built-in `oxc/no-accumulating-spread` rule.

This configuration consists of the most useful and least annoying rules from the following ESlint/Oxlint plugins:

- [`eslint-plugin-unicorn`](https://github.com/sindresorhus/eslint-plugin-unicorn)
- [`eslint-plugin-import-x`](https://github.com/un-ts/eslint-plugin-import-x)
- [`eslint-plugin-react`](https://github.com/jsx-eslint/eslint-plugin-react)
- [`eslint-plugin-react-hooks`](https://github.com/facebook/react/tree/main/packages/eslint-plugin-react-hooks)
- [`eslint-plugin-perfectionist`](https://perfectionist.dev/)
- [`eslint-plugin-no-instanceof`](https://www.npmjs.com/package/eslint-plugin-no-instanceof)
- [`eslint-plugin-no-only-tests`](https://github.com/levibuzolic/eslint-plugin-no-only-tests)

## Suggestions

This configuration is meant to be used with:

- [TypeScript](https://www.typescriptlang.org/) and the [`noUnusedLocals`](https://www.typescriptlang.org/tsconfig#noUnusedLocals) setting
- [Oxfmt](https://oxc.rs/docs/guide/usage/formatter.html)

## Alternatives

If you are using ESLint, check out [`@nkzw/eslint-config`](https://github.com/nkzw-tech/eslint-config).
