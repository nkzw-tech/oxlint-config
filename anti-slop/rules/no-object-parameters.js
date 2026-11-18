import {
  functionParameterBindingName,
  functionParameterTypeAnnotation,
} from '../shared/function-parameters.js';
import { withTypeBindings, resolvedTypeMatches } from '../shared/type-alias-resolution.js';

const resolvesToObject = (type, environment) =>
  resolvedTypeMatches(type, environment, (resolved, matches) => {
    if (resolved.type === 'TSObjectKeyword') {
      return true;
    }
    if (resolved.type === 'TSParenthesizedType') {
      return matches(resolved.typeAnnotation);
    }
    return resolved.type === 'TSUnionType' && resolved.types.some(matches);
  });

/** Ban the broad object type on function inputs, including local aliases to object. */
export const noObjectParametersRule = {
  createOnce(context) {
    const checkParameter = (parameter, environment) => {
      const type = functionParameterTypeAnnotation(parameter).typeAnnotation;
      if (resolvesToObject(type, environment)) {
        context.report({
          data: { parameter: functionParameterBindingName(parameter, context.sourceCode) },
          messageId: 'objectParameter',
          node: type,
        });
      }
    };

    return withTypeBindings(context, (defer) => {
      const checkParameters = (node) => {
        for (const parameter of node.params) {
          if (functionParameterTypeAnnotation(parameter)) {
            defer(checkParameter, parameter);
          }
        }
      };
      return {
        ArrowFunctionExpression: checkParameters,
        FunctionDeclaration: checkParameters,
        FunctionExpression: checkParameters,
        TSCallSignatureDeclaration: checkParameters,
        TSConstructorType: checkParameters,
        TSConstructSignatureDeclaration: checkParameters,
        TSDeclareFunction: checkParameters,
        TSEmptyBodyFunctionExpression: checkParameters,
        TSFunctionType: checkParameters,
        TSMethodSignature: checkParameters,
      };
    });
  },
  meta: {
    docs: {
      description:
        'Disallow object function parameters; inputs must use an owner-provided type and be parsed at their boundary.',
    },
    messages: {
      objectParameter:
        'Parameter `{{parameter}}` uses the broad `object` type. Accept a named owner type; parse external input at its boundary before calling this function.',
    },
    type: 'problem',
  },
};
