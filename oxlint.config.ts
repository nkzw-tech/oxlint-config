import config from './with-sorting.js';

export default {
  ...config,
  ignorePatterns: [...(config.ignorePatterns ?? []), 'types/oxlint.d.ts'],
};
