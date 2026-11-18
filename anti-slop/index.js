// Adapted from dmmulroy/anti-slop at 13909c9e07590f5a85d93c62712259fe14a883f7.
import { noArrayFilterMapRule } from './rules/no-array-filter-map.js';
import { noChainedTypeAssertionsRule } from './rules/no-chained-type-assertions.js';
import { noConditionalEmptyObjectSpreadRule } from './rules/no-conditional-empty-object-spread.js';
import { noKnownValueWideningRule } from './rules/no-known-value-widening.js';
import { noObjectParametersRule } from './rules/no-object-parameters.js';
import { noReduceAccumulatorCopyRule } from './rules/no-reduce-accumulator-copy.js';
import { noReflectApplyRule } from './rules/no-reflect-apply.js';
import { noReflectGetRule } from './rules/no-reflect-get.js';
import { noUnknownReturnsRule } from './rules/no-unknown-returns.js';
import { noUnknownTypeAliasesRule } from './rules/no-unknown-type-aliases.js';
import { noUnsafeDictionaryTypeRule } from './rules/no-unsafe-dictionary-type.js';
import { noWidenThenAssertRule } from './rules/no-widen-then-assert.js';

export default {
  meta: { name: 'anti-slop' },
  rules: {
    'no-array-filter-map': noArrayFilterMapRule,
    'no-chained-type-assertions': noChainedTypeAssertionsRule,
    'no-conditional-empty-object-spread': noConditionalEmptyObjectSpreadRule,
    'no-known-value-widening': noKnownValueWideningRule,
    'no-object-parameters': noObjectParametersRule,
    'no-reduce-accumulator-copy': noReduceAccumulatorCopyRule,
    'no-reflect-apply': noReflectApplyRule,
    'no-reflect-get': noReflectGetRule,
    'no-unknown-returns': noUnknownReturnsRule,
    'no-unknown-type-aliases': noUnknownTypeAliasesRule,
    'no-unsafe-dictionary-type': noUnsafeDictionaryTypeRule,
    'no-widen-then-assert': noWidenThenAssertRule,
  },
};
