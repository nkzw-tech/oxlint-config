import base from './index.js';

/** @satisfies {import('oxlint').OxlintConfig} */
const config = {
  ...base,
  jsPlugins: [
    ...(base.jsPlugins ?? []),
    {
      name: 'perfectionist',
      specifier: import.meta.resolve('eslint-plugin-perfectionist'),
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
};

export default config;
