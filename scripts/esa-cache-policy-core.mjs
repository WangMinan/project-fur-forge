const METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE']
const ALLOWED_HOST_SCOPES = new Set([
  'admin-host',
  'public-and-admin-hosts',
  'public-host',
  'public-media.ditedog.com',
])
const RULE_SHAPES = {
  'admin-host-bypass': [10, 'admin-host', '/**', METHODS],
  'app-api-session-bypass': [20, 'public-and-admin-hosts', '/api/**', METHODS],
  'nuxt-immutable-assets': [30, 'public-host', '/_nuxt/**', ['GET', 'HEAD']],
  'public-ssr-html-bypass': [40, 'public-host', '/**', METHODS],
  'public-media-immutable': [50, 'public-media.ditedog.com', '/prod/web/**', ['GET', 'HEAD']],
  'public-media-deny-other-paths': [60, 'public-media.ditedog.com', '/**', METHODS],
}

function requireRule(rules, id) {
  const rule = rules.find(candidate => candidate.id === id)
  if (!rule) {
    throw new Error(`ESA cache policy is missing rule ${id}.`)
  }
  return rule
}

function assertBypass(rule) {
  if (rule.edgeCache !== 'bypass' || rule.browserCacheSeconds !== 0) {
    throw new Error(`ESA cache rule ${rule.id} must bypass edge and browser cache.`)
  }
}

function assertImmutable(rule, input) {
  if (
    rule.edgeCache !== 'cache'
    || rule.edgeCacheSeconds !== input.edgeCacheSeconds
    || rule.browserCacheSeconds !== input.browserCacheSeconds
    || rule.queryString !== 'ignore-all'
    || rule.cache404Seconds !== 60
    || rule.serveStaleOnOriginError !== false
  ) {
    throw new Error(`ESA immutable cache rule ${rule.id} does not match the frozen contract.`)
  }
}

export function validateEsaCachePolicy(policy) {
  if (!policy || typeof policy !== 'object' || policy.schemaVersion !== 1) {
    throw new Error('ESA cache policy schemaVersion must be 1.')
  }
  if (!Array.isArray(policy.rules) || policy.rules.length !== 6) {
    throw new Error('ESA cache policy must contain exactly six ordered rules.')
  }
  const ids = new Set()
  const priorities = new Set()
  for (const rule of policy.rules) {
    if (!rule || typeof rule !== 'object' || typeof rule.id !== 'string') {
      throw new Error('ESA cache policy contains an invalid rule.')
    }
    if (ids.has(rule.id) || priorities.has(rule.priority)) {
      throw new Error('ESA cache policy rule ids and priorities must be unique.')
    }
    if (!ALLOWED_HOST_SCOPES.has(rule.hostScope)) {
      throw new Error(`ESA cache rule ${rule.id} has an unknown host scope.`)
    }
    if (!Array.isArray(rule.methods) || rule.methods.some(method => !METHODS.includes(method))) {
      throw new Error(`ESA cache rule ${rule.id} has invalid methods.`)
    }
    const shape = RULE_SHAPES[rule.id]
    if (
      !shape
      || rule.priority !== shape[0]
      || rule.hostScope !== shape[1]
      || rule.path !== shape[2]
      || JSON.stringify(rule.methods) !== JSON.stringify(shape[3])
    ) {
      throw new Error(`ESA cache rule ${rule.id} scope or priority drifted.`)
    }
    ids.add(rule.id)
    priorities.add(rule.priority)
  }

  const ordered = [...policy.rules].sort((left, right) => left.priority - right.priority)
  if (ordered.some((rule, index) => rule !== policy.rules[index])) {
    throw new Error('ESA cache policy rules must be stored in priority order.')
  }

  assertBypass(requireRule(policy.rules, 'admin-host-bypass'))
  assertBypass(requireRule(policy.rules, 'app-api-session-bypass'))
  assertBypass(requireRule(policy.rules, 'public-ssr-html-bypass'))
  assertImmutable(requireRule(policy.rules, 'nuxt-immutable-assets'), {
    browserCacheSeconds: 31536000,
    edgeCacheSeconds: 31536000,
  })
  assertImmutable(requireRule(policy.rules, 'public-media-immutable'), {
    browserCacheSeconds: 604800,
    edgeCacheSeconds: 2592000,
  })
  const mediaDeny = requireRule(policy.rules, 'public-media-deny-other-paths')
  assertBypass(mediaDeny)
  if (mediaDeny.deny !== true) {
    throw new Error('ESA media fallback rule must deny non-derivative paths.')
  }
  return policy
}
