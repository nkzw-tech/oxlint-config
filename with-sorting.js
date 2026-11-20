import { defineConfig } from 'oxlint';
import base from './index.js';

// Perfectionist is an optional peer dependency: only this preset loads it.
const resolvePerfectionist = () => {
  try {
    return import.meta.resolve('eslint-plugin-perfectionist');
  } catch (error) {
    throw new Error(
      '`@nkzw/oxlint-config/with-sorting` requires `eslint-plugin-perfectionist`. Install it with `npm install -D eslint-plugin-perfectionist`.',
      { cause: error },
    );
  }
};

export default defineConfig({
  ...base,
  jsPlugins: [
    ...base.jsPlugins,
    {
      name: 'perfectionist',
      specifier: resolvePerfectionist(),
    },
  ],
  rules: {
    ...base.rules,
    'perfectionist/sort-enums': [
      'error',
      {
        partitionByComment: true,
        sortByValue: 'always',
      },
    ],
    'perfectionist/sort-heritage-clauses': 'error',
    'perfectionist/sort-interfaces': 'error',
    'perfectionist/sort-jsx-props': 'error',
    'perfectionist/sort-object-types': 'error',
    'perfectionist/sort-objects': [
      'error',
      {
        partitionByComment: true,
      },
    ],
  },
});
