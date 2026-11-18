import { withTypeBindings, resolvedTypeMatches } from '../shared/type-alias-resolution.js';

const resolvesToUnknown = (type, environment) =>
  resolvedTypeMatches(type, environment, (resolved, matches) => {
    if (resolved.type === 'TSUnknownKeyword') {
      return true;
    }
    if (resolved.type === 'TSParenthesizedType') {
      return matches(resolved.typeAnnotation);
    }
    if (resolved.type === 'TSUnionType') {
      return resolved.types.some(matches);
    }
    if (
      resolved.type !== 'TSTypeReference' ||
      resolved.typeName.type !== 'Identifier' ||
      (resolved.typeName.name !== 'Promise' && resolved.typeName.name !== 'PromiseLike')
    ) {
      return false;
    }
    const value = resolved.typeArguments?.params[0];
    return value !== undefined && matches(value);
  });

/** Ban function contracts that return unknown instead of a parsed domain type. */
export const noUnknownReturnsRule = {
  createOnce(context) {
    const check = (type, environment) => {
      if (resolvesToUnknown(type, environment)) {
        context.report({ messageId: 'unknownReturn', node: type });
      }
    };
    return withTypeBindings(context, (defer) => {
      const checkReturnType = (node) => {
        if (node.returnType) {
          defer(check, node.returnType.typeAnnotation);
        }
      };
      return {
        ArrowFunctionExpression: checkReturnType,
        FunctionDeclaration: checkReturnType,
        FunctionExpression: checkReturnType,
        TSCallSignatureDeclaration: checkReturnType,
        TSConstructorType: checkReturnType,
        TSConstructSignatureDeclaration: checkReturnType,
        TSDeclareFunction: checkReturnType,
        TSEmptyBodyFunctionExpression: checkReturnType,
        TSFunctionType: checkReturnType,
        TSMethodSignature: checkReturnType,
      };
    });
  },
  meta: {
    docs: {
      description:
        'Disallow functions whose explicit return contract is unknown or Promise<unknown>.',
    },
    messages: {
      unknownReturn:
        'This function exposes `unknown` to its caller. Parse the value at its boundary and return a named domain type.',
    },
    type: 'problem',
  },
};
