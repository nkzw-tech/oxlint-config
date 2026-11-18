import { lexicalTypeParameterNames } from './lexical-type-parameters.js';

const environmentsByProgram = new WeakMap();

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

const bindingTypes = [
  'ClassDeclaration',
  'ClassExpression',
  'ImportDefaultSpecifier',
  'ImportNamespaceSpecifier',
  'ImportSpecifier',
  'TSEnumDeclaration',
  'TSInterfaceDeclaration',
  'TSTypeAliasDeclaration',
];

function recordBinding(node, environment) {
  const name = (node.local ?? node.id)?.name;
  if (name === undefined) {
    return;
  }
  let scopes = environment.bindingsByName.get(name);
  if (!scopes) {
    scopes = new Map();
    environment.bindingsByName.set(name, scopes);
  }
  const scope = enclosingTypeScope(node);
  // Multiple declarations in one scope make an alias ambiguous.
  scopes.set(scope, !scopes.has(scope) && node.type === 'TSTypeAliasDeclaration' ? node : null);

  if (node.type === 'TSInterfaceDeclaration') {
    const parent = node.parent;
    if (
      parent.type === 'Program' ||
      ((parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportDefaultDeclaration') &&
        parent.parent.type === 'Program')
    ) {
      const declarations = environment.interfaces.get(name) ?? [];
      declarations.push(node);
      environment.interfaces.set(name, declarations);
    }
  }
}

/**
 * Let Oxlint's traversal index declarations once for all enabled type rules.
 * Defer only candidate checks until the complete index includes forward declarations.
 */
export function withTypeBindings(context, createVisitors) {
  const checks = [];
  const visitors = createVisitors((check, node) => checks.push(check, node));
  let environment;
  let collect;
  for (const kind of bindingTypes) {
    const visit = visitors[kind];
    visitors[kind] = (node) => {
      if (collect) {
        recordBinding(node, environment);
      }
      visit?.(node);
    };
  }
  const start = visitors.Program;
  visitors.Program = (program) => {
    checks.length = 0;
    environment = environmentsByProgram.get(program);
    collect = !environment;
    if (collect) {
      environment = {
        bindingsByName: new Map(),
        interfaces: new Map(),
        visitorKeys: context.sourceCode.visitorKeys,
      };
      environmentsByProgram.set(program, environment);
    }
    start?.();
  };
  visitors['Program:exit'] = () => {
    for (let i = 0; i < checks.length; i += 2) {
      checks[i](checks[i + 1], environment);
    }
    checks.length = 0;
    environment = null;
  };
  return visitors;
}

export function visibleTypeAlias(name, use, environment) {
  const scopes = environment.bindingsByName.get(name);
  if (!scopes || lexicalTypeParameterNames(use, environment.visitorKeys).has(name)) {
    return null;
  }
  for (let node = use; node; node = node.parent) {
    if (scopes.has(node)) {
      return scopes.get(node);
    }
  }
  return null;
}

export function hasVisibleTypeBinding(name, use, environment) {
  if (lexicalTypeParameterNames(use, environment.visitorKeys).has(name)) {
    return true;
  }
  const scopes = environment.bindingsByName.get(name);
  if (scopes) {
    for (let node = use; node; node = node.parent) {
      if (scopes.has(node)) {
        return true;
      }
    }
  }
  return false;
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
