import {
  classifyUnsafeDictionaryValue,
  classifyWideningTarget,
  isKnownEvidenceExpression,
} from '../shared/dictionary-types.js';
import {
  containsUnknownType,
  functionParameterBindingName,
  functionParameterTypeAnnotation,
} from '../shared/function-parameters.js';
import { resolveVariable } from '../shared/scope.js';
import { withTypeBindings } from '../shared/type-alias-resolution.js';

function unwrapExpression(expression) {
  let current = expression;
  while (
    current.type === 'ParenthesizedExpression' ||
    current.type === 'TSAsExpression' ||
    current.type === 'TSSatisfiesExpression' ||
    current.type === 'TSTypeAssertion' ||
    current.type === 'TSNonNullExpression'
  ) {
    current = current.expression;
  }
  return current;
}

function variableDeclarator(variable) {
  if (variable.defs.length !== 1) {
    return null;
  }
  const [definition] = variable.defs;
  return definition?.type === 'Variable' && definition.node.type === 'VariableDeclarator'
    ? definition.node
    : null;
}

function isStableConstVariable(variable, declarator) {
  return (
    declarator.parent.type === 'VariableDeclaration' &&
    declarator.parent.kind === 'const' &&
    variable.references.every((reference) => reference.init || !reference.isWrite())
  );
}

function hasKnownEvidence(sourceCode, expression, visitedVariables = new Set()) {
  if (isKnownEvidenceExpression(expression)) {
    return true;
  }
  const unwrapped = unwrapExpression(expression);
  if (unwrapped.type !== 'Identifier') {
    return false;
  }
  const variable = resolveVariable(sourceCode, unwrapped);
  if (variable === null || visitedVariables.has(variable)) {
    return false;
  }
  const declarator = variableDeclarator(variable);
  if (
    declarator === null ||
    declarator.init === null ||
    !isStableConstVariable(variable, declarator)
  ) {
    return false;
  }
  visitedVariables.add(variable);
  return hasKnownEvidence(sourceCode, declarator.init, visitedVariables);
}

function isFunctionExpression(node) {
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'TSDeclareFunction' ||
    node.type === 'TSEmptyBodyFunctionExpression'
  );
}

function localFunctionForCall(sourceCode, callee) {
  const unwrapped = unwrapExpression(callee);
  if (isFunctionExpression(unwrapped)) {
    return unwrapped;
  }
  if (unwrapped.type !== 'Identifier') {
    return null;
  }
  const variable = resolveVariable(sourceCode, unwrapped);
  if (variable === null || variable.defs.length !== 1) {
    return null;
  }
  const [definition] = variable.defs;
  if (definition === undefined) {
    return null;
  }
  if (definition.type === 'FunctionName' && isFunctionExpression(definition.node)) {
    return definition.node;
  }
  if (definition.type !== 'Variable' || definition.node.type !== 'VariableDeclarator') {
    return null;
  }
  const initializer = definition.node.init;
  if (initializer === null) {
    return null;
  }
  const unwrappedInitializer = unwrapExpression(initializer);
  return isFunctionExpression(unwrappedInitializer) ? unwrappedInitializer : null;
}

function variableTypeAnnotation(sourceCode, variable) {
  if (variable.defs.length !== 1) {
    return null;
  }
  const [definition] = variable.defs;
  if (definition === undefined) {
    return null;
  }
  if (
    definition.type === 'Variable' &&
    definition.node.type === 'VariableDeclarator' &&
    definition.node.id.type === 'Identifier'
  ) {
    return definition.node.id.typeAnnotation ?? null;
  }
  if (definition.type !== 'Parameter' || !isFunctionExpression(definition.node)) {
    return null;
  }
  const parameter = definition.node.params.find(
    (candidate) => functionParameterBindingName(candidate, sourceCode) === variable.name,
  );
  return parameter === undefined ? null : (functionParameterTypeAnnotation(parameter) ?? null);
}

function hasInformativeType(type, environment) {
  return classifyUnsafeDictionaryValue(type, environment) === null;
}

function hasKnownCallArgumentEvidence(
  sourceCode,
  expression,
  environment,
  visitedVariables = new Set(),
) {
  if (expression.type === 'ParenthesizedExpression' || expression.type === 'TSNonNullExpression') {
    return hasKnownCallArgumentEvidence(
      sourceCode,
      expression.expression,
      environment,
      visitedVariables,
    );
  }
  if (expression.type === 'TSAsExpression' || expression.type === 'TSTypeAssertion') {
    return hasInformativeType(expression.typeAnnotation, environment);
  }
  if (expression.type === 'TSSatisfiesExpression') {
    return hasKnownCallArgumentEvidence(
      sourceCode,
      expression.expression,
      environment,
      visitedVariables,
    );
  }
  if (expression.type === 'CallExpression') {
    const owner = localFunctionForCall(sourceCode, expression.callee);
    const returnType = owner?.returnType?.typeAnnotation;
    return returnType !== undefined && hasInformativeType(returnType, environment);
  }
  if (expression.type !== 'Identifier') {
    return isKnownEvidenceExpression(expression);
  }
  const variable = resolveVariable(sourceCode, expression);
  if (variable === null || visitedVariables.has(variable)) {
    return false;
  }
  const annotation = variableTypeAnnotation(sourceCode, variable);
  if (annotation !== null) {
    return hasInformativeType(annotation.typeAnnotation, environment);
  }
  const declarator = variableDeclarator(variable);
  if (
    declarator === null ||
    declarator.init === null ||
    !isStableConstVariable(variable, declarator)
  ) {
    return false;
  }
  visitedVariables.add(variable);
  return hasKnownCallArgumentEvidence(sourceCode, declarator.init, environment, visitedVariables);
}

function typePredicateSubjectIndex(sourceCode, owner) {
  const predicate = owner.returnType?.typeAnnotation;
  if (predicate?.type !== 'TSTypePredicate' || predicate.parameterName.type !== 'Identifier') {
    return null;
  }
  const predicateParameterName = predicate.parameterName.name;
  const index = owner.params.findIndex(
    (parameter) => functionParameterBindingName(parameter, sourceCode) === predicateParameterName,
  );
  return index === -1 ? null : index;
}

function annotationTarget(annotation, environment) {
  return annotation === null || annotation === undefined
    ? null
    : classifyWideningTarget(annotation.typeAnnotation, environment);
}

function enclosingFunction(node) {
  let current = node.parent;
  while (current !== null && current.type !== 'Program') {
    if (
      current.type === 'ArrowFunctionExpression' ||
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression'
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function sourceKeyName(sourceCode, key) {
  if (key.type === 'Identifier' || key.type === 'PrivateIdentifier') {
    return key.name;
  }
  if (key.type === 'Literal') {
    return String(key.value);
  }
  return sourceCode.getText(key);
}

function functionName(sourceCode, owner) {
  if (owner === null) {
    return 'anonymous function';
  }
  if (owner.id !== null) {
    return owner.id.name;
  }
  const parent = owner.parent;
  if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
    return parent.id.name;
  }
  if (parent.type === 'MethodDefinition') {
    return sourceKeyName(sourceCode, parent.key);
  }
  return 'anonymous function';
}

function isEmptyObjectExpression(expression) {
  const unwrapped = unwrapExpression(expression);
  return unwrapped.type === 'ObjectExpression' && unwrapped.properties.length === 0;
}

function isDictionaryAccumulatorTarget(destination) {
  return destination.kind === 'open dictionary' || destination.kind === 'generic container';
}

function hasParentAssertion(node) {
  return node.parent?.type === 'TSAsExpression' || node.parent?.type === 'TSTypeAssertion';
}

/** Detect sound syntactic cases where a known value is explicitly widened and loses evidence. */
export const noKnownValueWideningRule = {
  createOnce(context) {
    const annotatedBindings = new Set();
    const predicateNames = new Set();
    const reportFlow = (expression, destination, subject) => {
      if (destination === null) {
        return;
      }
      if (isDictionaryAccumulatorTarget(destination) && isEmptyObjectExpression(expression)) {
        return;
      }
      if (!hasKnownEvidence(context.sourceCode, expression)) {
        return;
      }
      context.report({
        data: { subject, target: destination.kind },
        messageId: 'widening',
        node: expression,
      });
    };

    const checkAssignment = (node, environment) => {
      if (!annotatedBindings.has(node.left.name)) {
        return;
      }
      const variable = resolveVariable(context.sourceCode, node.left);
      if (variable === null) {
        return;
      }
      const declarator = variableDeclarator(variable);
      if (declarator === null || declarator.id.type !== 'Identifier') {
        return;
      }
      reportFlow(
        node.right,
        annotationTarget(declarator.id.typeAnnotation, environment),
        `binding \`${declarator.id.name}\``,
      );
    };

    const checkPredicateCall = (node, environment) => {
      const callee = unwrapExpression(node.callee);
      if (callee.type === 'Identifier' && !predicateNames.has(callee.name)) {
        return;
      }
      const owner = localFunctionForCall(context.sourceCode, node.callee);
      if (owner === null) {
        return;
      }
      const parameterIndex = typePredicateSubjectIndex(context.sourceCode, owner);
      if (parameterIndex === null) {
        return;
      }
      const parameter = owner.params[parameterIndex];
      const argument = node.arguments[parameterIndex];
      if (parameter === undefined || argument === undefined || argument.type === 'SpreadElement') {
        return;
      }
      const parameterAnnotation = functionParameterTypeAnnotation(parameter);
      if (
        parameterAnnotation === null ||
        parameterAnnotation === undefined ||
        !containsUnknownType(parameterAnnotation.typeAnnotation)
      ) {
        return;
      }
      if (!hasKnownCallArgumentEvidence(context.sourceCode, argument, environment)) {
        return;
      }
      context.report({
        data: {
          subject: `argument for parameter \`${functionParameterBindingName(parameter, context.sourceCode)}\` of \`${functionName(context.sourceCode, owner)}\``,
          target: 'unknown',
        },
        messageId: 'widening',
        node: argument,
      });
    };

    const checkProperty = (node, environment) => {
      reportFlow(
        node.value,
        annotationTarget(node.typeAnnotation, environment),
        `property \`${sourceKeyName(context.sourceCode, node.key)}\``,
      );
    };
    const checkReturn = (node, environment) => {
      const owner = node.type === 'ArrowFunctionExpression' ? node : enclosingFunction(node);
      if (owner?.returnType) {
        reportFlow(
          node.type === 'ArrowFunctionExpression' ? node.body : node.argument,
          annotationTarget(owner.returnType, environment),
          `return value of \`${functionName(context.sourceCode, owner)}\``,
        );
      }
    };
    const checkAssertion = (node, environment) => {
      reportFlow(
        node.expression,
        classifyWideningTarget(node.typeAnnotation, environment),
        'assertion',
      );
    };
    const checkVariable = (node, environment) => {
      reportFlow(
        node.init,
        annotationTarget(node.id.typeAnnotation, environment),
        `binding \`${node.id.name}\``,
      );
    };

    return withTypeBindings(context, (defer) => {
      const property = (node) => {
        if (node.typeAnnotation && node.value) {
          defer(checkProperty, node);
        }
      };
      const assertion = (node) => {
        if (!hasParentAssertion(node)) {
          defer(checkAssertion, node);
        }
      };
      return {
        AccessorProperty: property,
        ArrowFunctionExpression(node) {
          if (node.returnType && node.body.type !== 'BlockStatement') {
            defer(checkReturn, node);
          }
        },
        AssignmentExpression(node) {
          if (node.operator === '=' && node.left.type === 'Identifier') {
            defer(checkAssignment, node);
          }
        },
        CallExpression(node) {
          const callee = unwrapExpression(node.callee);
          if (callee.type === 'Identifier' || isFunctionExpression(callee)) {
            defer(checkPredicateCall, node);
          }
        },
        Program() {
          predicateNames.clear();
          annotatedBindings.clear();
        },
        PropertyDefinition: property,
        ReturnStatement(node) {
          if (node.argument) {
            defer(checkReturn, node);
          }
        },
        TSAsExpression: assertion,
        TSTypeAssertion: assertion,
        TSTypePredicate(node) {
          const owner = node.parent.parent;
          if (!isFunctionExpression(owner) || owner.returnType?.typeAnnotation !== node) {
            return;
          }
          if (owner.id) {
            predicateNames.add(owner.id.name);
          }
          let initializer = owner;
          while (initializer.parent.expression === initializer) {
            initializer = initializer.parent;
          }
          const declaration = initializer.parent;
          if (declaration.type === 'VariableDeclarator' && declaration.init === initializer) {
            if (declaration.id.type === 'Identifier') {
              predicateNames.add(declaration.id.name);
            } else {
              for (const variable of context.sourceCode.getDeclaredVariables(declaration)) {
                predicateNames.add(variable.name);
              }
            }
          }
        },
        VariableDeclarator(node) {
          if (node.id.type === 'Identifier' && node.id.typeAnnotation) {
            annotatedBindings.add(node.id.name);
            if (node.init) {
              defer(checkVariable, node);
            }
          }
        },
      };
    });
  },
  meta: {
    docs: {
      description:
        'Disallow syntactically established values from flowing into explicitly broad or anonymous target types that discard useful evidence.',
    },
    messages: {
      widening:
        'The explicit {{target}} type on {{subject}} discards known type evidence. Keep inference, validate with `satisfies`, or use a named owner contract.',
    },
    type: 'problem',
  },
};
