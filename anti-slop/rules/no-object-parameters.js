import {
  functionParameterBindingName,
  functionParameterTypeAnnotation,
} from '../shared/function-parameters.js';
import {
  createTypeAliasEnvironment,
  resolvedTypeMatches,
} from '../shared/type-alias-resolution.js';

/** Ban the broad object type on function inputs, including local aliases to object. */
export const noObjectParametersRule = {
  createOnce(context) {
    let environment = null;

    const resolvesToObject = (type) =>
      environment !== null &&
      resolvedTypeMatches(type, environment, (resolved, matches) => {
        if (resolved.type === 'TSObjectKeyword') {
          return true;
        }
        if (resolved.type === 'TSParenthesizedType') {
          return matches(resolved.typeAnnotation);
        }
        return resolved.type === 'TSUnionType' && resolved.types.some(matches);
      });

    const checkParameters = (node) => {
      for (const parameter of node.params) {
        const annotation = functionParameterTypeAnnotation(parameter);
        if (annotation === null || annotation === undefined) {
          continue;
        }
        if (!resolvesToObject(annotation.typeAnnotation)) {
          continue;
        }
        context.report({
          data: { parameter: functionParameterBindingName(parameter, context.sourceCode) },
          messageId: 'objectParameter',
          node: annotation.typeAnnotation,
        });
      }
    };

    return {
      ArrowFunctionExpression: checkParameters,
      FunctionDeclaration: checkParameters,
      FunctionExpression: checkParameters,
      Program(node) {
        environment = createTypeAliasEnvironment(node, context.sourceCode.visitorKeys);
      },
      TSCallSignatureDeclaration: checkParameters,
      TSConstructorType: checkParameters,
      TSConstructSignatureDeclaration: checkParameters,
      TSDeclareFunction: checkParameters,
      TSEmptyBodyFunctionExpression: checkParameters,
      TSFunctionType: checkParameters,
      TSMethodSignature: checkParameters,
    };
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
