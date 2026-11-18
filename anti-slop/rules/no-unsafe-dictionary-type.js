import {
  classifyUnsafeDictionary,
  classifyUnsafeDictionaryValue,
} from '../shared/dictionary-types.js';
import { visibleTypeAlias, withTypeBindings } from '../shared/type-alias-resolution.js';

const typeNodeKinds = new Set([
  'JSDocNonNullableType',
  'JSDocNullableType',
  'JSDocUnknownType',
  'TSAnyKeyword',
  'TSArrayType',
  'TSBigIntKeyword',
  'TSBooleanKeyword',
  'TSConditionalType',
  'TSConstructorType',
  'TSFunctionType',
  'TSImportType',
  'TSIndexedAccessType',
  'TSInferType',
  'TSIntersectionType',
  'TSIntrinsicKeyword',
  'TSLiteralType',
  'TSMappedType',
  'TSNamedTupleMember',
  'TSNeverKeyword',
  'TSNullKeyword',
  'TSNumberKeyword',
  'TSObjectKeyword',
  'TSParenthesizedType',
  'TSStringKeyword',
  'TSSymbolKeyword',
  'TSTemplateLiteralType',
  'TSThisType',
  'TSTupleType',
  'TSTypeLiteral',
  'TSTypeOperator',
  'TSTypePredicate',
  'TSTypeQuery',
  'TSTypeReference',
  'TSUndefinedKeyword',
  'TSUnionType',
  'TSUnknownKeyword',
  'TSVoidKeyword',
]);

function isTypeNode(node) {
  return typeNodeKinds.has(node.type);
}

function typeReferenceName(type) {
  return type.typeName.type === 'Identifier' ? type.typeName.name : null;
}

function isInsideTypeAliasDeclaration(node) {
  let current = node.parent;
  while (current !== null && current.type !== 'Program') {
    if (current.type === 'TSTypeAliasDeclaration') {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function isPlainAliasConsumerUse(node, environment) {
  if (node.type !== 'TSTypeReference' || node.typeArguments?.params.length) {
    return false;
  }
  const name = typeReferenceName(node);
  return (
    name !== null &&
    visibleTypeAlias(name, node, environment) !== null &&
    !isInsideTypeAliasDeclaration(node)
  );
}

function isInsideTypeParameterConstraint(node) {
  let child = node;
  let parent = child.parent;
  while (parent !== null && parent.type !== 'Program') {
    if (parent.type === 'TSTypeParameter' && parent.constraint === child) {
      return true;
    }
    child = parent;
    parent = child.parent;
  }
  return false;
}

function isSuppressed(node, environment) {
  if (isInsideTypeParameterConstraint(node)) {
    return true;
  }
  if (isPlainAliasConsumerUse(node, environment)) {
    return true;
  }
  let current = node.parent;
  while (current !== null && current.type !== 'Program') {
    if (isTypeNode(current) && classifyUnsafeDictionary(current, environment) !== null) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/** Disallow object-dictionary contracts whose direct value type is an unsafe escape hatch. */
export const noUnsafeDictionaryTypeRule = {
  createOnce(context) {
    const report = (node, value) => {
      context.report({ data: { value }, messageId: 'unsafeDictionary', node });
    };
    const reportIfUnsafe = (node, environment) => {
      const unsafe = classifyUnsafeDictionary(node, environment);
      if (unsafe === null || isSuppressed(node, environment)) {
        return;
      }
      report(node, unsafe.unsafeValue);
    };

    const checkIndex = (node, environment) => {
      const unsafe = classifyUnsafeDictionaryValue(node.typeAnnotation.typeAnnotation, environment);
      if (unsafe !== null) {
        report(node, unsafe.unsafeValue);
      }
    };
    return withTypeBindings(context, (defer) => {
      const checkType = (node) => defer(reportIfUnsafe, node);
      return {
        TSIndexSignature(node) {
          if (node.typeAnnotation && node.parent.type !== 'TSTypeLiteral') {
            defer(checkIndex, node);
          }
        },
        TSMappedType: checkType,
        TSTypeLiteral: checkType,
        TSTypeReference: checkType,
      };
    });
  },
  meta: {
    docs: {
      description:
        'Disallow object-dictionary contracts whose direct value type is unknown, any, object, {}, or a union/alias containing one of those escape hatches.',
    },
    messages: {
      unsafeDictionary:
        "This dictionary's {{value}} value type gives callers no concrete value contract. Use an owner/schema-derived value type; parse external payloads before insertion.",
    },
    type: 'problem',
  },
};
