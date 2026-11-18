function isNode(value) {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  );
}

function hasInferTypeParameter(node, name, visitorKeys) {
  if (node.type === 'TSInferType' && node.typeParameter.name.name === name) {
    return true;
  }
  for (const key of visitorKeys[node.type] ?? []) {
    const value = node[key];
    if (isNode(value) && hasInferTypeParameter(value, name, visitorKeys)) {
      return true;
    }
    if (
      Array.isArray(value) &&
      value.some((child) => isNode(child) && hasInferTypeParameter(child, name, visitorKeys))
    ) {
      return true;
    }
  }
  return false;
}

/** Check the type parameters introduced at this step of a lexical scope walk. */
export function bindsTypeParameter(node, child, name, visitorKeys) {
  return (
    node.typeParameters?.params.some((parameter) => parameter.name.name === name) ||
    (node.type === 'TSMappedType' &&
      (child === node.nameType || child === node.typeAnnotation) &&
      node.key.name === name) ||
    (node.type === 'TSConditionalType' &&
      child === node.trueType &&
      hasInferTypeParameter(node.extendsType, name, visitorKeys))
  );
}
