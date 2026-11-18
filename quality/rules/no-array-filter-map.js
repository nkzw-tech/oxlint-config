import {
  arrayMethodTarget,
  isKnownArrayExpression,
  unwrapArrayExpression,
} from '../shared/array-method.js';

/** Reject eager array filter/map pipelines; lazy iterator helpers remain allowed. */
export const noArrayFilterMapRule = {
  createOnce(context) {
    return {
      CallExpression(node) {
        const outer = arrayMethodTarget(node.callee);
        if (outer === null || (outer.name !== 'map' && outer.name !== 'filter')) {
          return;
        }
        const innerCall = unwrapArrayExpression(outer.object);
        if (innerCall.type !== 'CallExpression') {
          return;
        }
        const inner = arrayMethodTarget(innerCall.callee);
        if (inner === null || inner.name !== (outer.name === 'map' ? 'filter' : 'map')) {
          return;
        }
        if (!isKnownArrayExpression(context.sourceCode, inner.object)) {
          return;
        }
        context.report({
          data: { first: inner.name, second: outer.name },
          messageId: 'arrayFilterMap',
          node,
        });
      },
    };
  },
  meta: {
    docs: {
      description:
        'Disallow adjacent array filter/map passes in favor of lazy iterator helpers or a single transformation.',
    },
    messages: {
      arrayFilterMap:
        'Avoid consecutive array `{{first}}` and `{{second}}` passes. Prefer `.values().{{first}}(...).{{second}}(...).toArray()` where iterator helpers are supported, or a single `flatMap`/mutating reducer. Preserve callback ordering, indexes, and filtering semantics.',
    },
    type: 'suggestion',
  },
};
