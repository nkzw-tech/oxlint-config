import { lexicalTypeParameterNames } from './lexical-type-parameters.js';

const environmentsByProgram = new WeakMap();

function isNode(value) {
  return (
    typeof value === 'object' && value !== null && 'type' in value && typeof value.type === 'string'
  );
}

function enclosingTypeScope(node) {
  let current = node.parent;
  while (current !== null) {
    if (
      current.type === 'Program' ||
      current.type === 'BlockStatement' ||
      current.type === 'TSModuleBlock' ||
      current.type === 'StaticBlock' ||
      current.type === 'SwitchStatement'
    ) {
      return current;
    }
    current = current.parent;
  }
  return node;
}

function declaredTypeBinding(node) {
  if (node.type === 'TSTypeAliasDeclaration') {
    return { alias: node, name: node.id.name };
  }
  if (
    node.type === 'TSInterfaceDeclaration' ||
    node.type === 'TSEnumDeclaration' ||
    node.type === 'ClassDeclaration' ||
    node.type === 'ClassExpression'
  ) {
    return node.id === null ? null : { alias: null, name: node.id.name };
  }
  if (
    node.type === 'ImportSpecifier' ||
    node.type === 'ImportDefaultSpecifier' ||
    node.type === 'ImportNamespaceSpecifier'
  ) {
    return { alias: null, name: node.local.name };
  }
  return null;
}

function collectTypeBindings(node, visitorKeys, bindingsByName) {
  const declared = declaredTypeBinding(node);
  if (declared !== null) {
    const bindings = bindingsByName.get(declared.name) ?? [];
    bindings.push({ ...declared, scope: enclosingTypeScope(node) });
    bindingsByName.set(declared.name, bindings);
  }

  for (const key of visitorKeys[node.type] ?? []) {
    const value = node[key];
    if (isNode(value)) {
      collectTypeBindings(value, visitorKeys, bindingsByName);
      continue;
    }
    if (!Array.isArray(value)) {
      continue;
    }
    for (const child of value) {
      if (isNode(child)) {
        collectTypeBindings(child, visitorKeys, bindingsByName);
      }
    }
  }
}

/** Collect every lexical type alias and competing type binding in a program. */
export function createTypeAliasEnvironment(program, visitorKeys) {
  const cached = environmentsByProgram.get(program);
  if (cached) {
    return cached;
  }
  const bindingsByName = new Map();
  collectTypeBindings(program, visitorKeys, bindingsByName);
  const environment = { bindingsByName, visitorKeys };
  environmentsByProgram.set(program, environment);
  return environment;
}

function ancestorDistance(ancestor, node) {
  let current = node;
  let distance = 0;
  while (current !== null) {
    if (current === ancestor) {
      return distance;
    }
    current = current.parent;
    distance += 1;
  }
  return null;
}

function nearestTypeBindings(name, use, environment) {
  const candidates = environment.bindingsByName.get(name) ?? [];
  let nearestDistance = Number.POSITIVE_INFINITY;
  let nearest = [];
  for (const candidate of candidates) {
    const distance = ancestorDistance(candidate.scope, use);
    if (distance === null || distance > nearestDistance) {
      continue;
    }
    if (distance === nearestDistance) {
      nearest.push(candidate);
      continue;
    }
    nearestDistance = distance;
    nearest = [candidate];
  }
  return nearest;
}

/** Resolve the nearest visible alias with this name, respecting lexical shadowing. */
export function visibleTypeAlias(name, use, environment) {
  if (lexicalTypeParameterNames(use, environment.visitorKeys).has(name)) {
    return null;
  }
  const bindings = nearestTypeBindings(name, use, environment);
  return bindings.length === 1 ? (bindings[0]?.alias ?? null) : null;
}

/** Return whether a local declaration shadows a built-in type at this use. */
export function hasVisibleTypeBinding(name, use, environment) {
  return (
    lexicalTypeParameterNames(use, environment.visitorKeys).has(name) ||
    nearestTypeBindings(name, use, environment).length > 0
  );
}

function typeReferenceName(type) {
  return type.typeName.type === 'Identifier' ? type.typeName.name : null;
}

function aliasSubstitutions(alias, reference, base) {
  const parameters = alias.typeParameters?.params ?? [];
  const arguments_ = reference.typeArguments?.params ?? [];
  const next = new Map(base);
  for (const [index, parameter] of parameters.entries()) {
    const explicitArgument = arguments_[index];
    const argument = explicitArgument ?? parameter.default;
    if (argument === null || argument === undefined) {
      return null;
    }
    const argumentSubstitutions = explicitArgument === undefined ? next : base;
    next.set(parameter.name.name, {
      substitutions: new Map(argumentSubstitutions),
      type: argument,
    });
  }
  return next;
}

/** Match a type after resolving visible aliases and substituting their type parameters. */
export function resolvedTypeMatches(type, environment, matcher) {
  const evaluate = (current, substitutions, resolvingAliases) => {
    if (current.type === 'TSTypeReference') {
      const name = typeReferenceName(current);
      if (name !== null) {
        const substitution = substitutions.get(name);
        if (substitution !== undefined && !current.typeArguments?.params.length) {
          return evaluate(substitution.type, substitution.substitutions, resolvingAliases);
        }
        const alias = visibleTypeAlias(name, current, environment);
        if (alias !== null && !resolvingAliases.has(alias)) {
          const nextSubstitutions = aliasSubstitutions(alias, current, substitutions);
          if (nextSubstitutions !== null) {
            const nextResolving = new Set(resolvingAliases);
            nextResolving.add(alias);
            return evaluate(alias.typeAnnotation, nextSubstitutions, nextResolving);
          }
        }
      }
    }
    return matcher(current, (child) => evaluate(child, substitutions, resolvingAliases));
  };

  return evaluate(type, new Map(), new Set());
}
