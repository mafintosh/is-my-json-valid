var xtend = require('xtend')

module.exports = function(schema) {
  var tree = {}

  var visit = function(root, node) {
    if (Array.isArray(node)) return visit(root, {anyOf:node})

    root.types = []
    root.required = !!node.required
    root.nullable = false

    var nodes = [].concat(node.anyOf || node.type).map(function(n) {
      if (typeof n === 'string') n = {type:n}
      return xtend(node, n)
    })

    root.types = nodes.map(function(node) {
      var root = {}

      root.type = node.type || 'any'
      root.conditions = 0

      if (node.additionalProperties === false) {
        root.additionalProperties = false
      }

      if (node.enum) {
        root.values = [].concat(node.enum)
        root.conditions++
      }

      ['minimum', 'maximum', 'minItems', 'maxItems', 'pattern', 'unique', 'format'].forEach(function(name) {
        if (node[name] !== undefined) {
          root[name] = node[name]
          root.conditions++
        }
      })

      if (root.minimum !== undefined) root.exclusiveMinimum = !!node.exclusiveMinimum
      if (root.maximum !== undefined) root.exclusiveMaximum = !!node.exclusiveMaximum

      if (root.pattern) root.pattern = root.pattern.replace(/(^\/)|(\/$)/g, '')

      switch (node.type) {
        case 'object':
        root.properties = {}
        root.conditions++

        Object.keys(node.properties || {}).forEach(function(name) {
          root.properties[name] = visit({}, node.properties[name])
          if (Array.isArray(root.required)) root.properties[name].required = root.required.indexOf(name) > -1
        })
        break

        case 'array':
        root.items = visit({}, node.items || {})
        root.conditions++
        break
      }

      return root
    })

    root.nullable = root.types.some(function(node) {
      return node.type === 'null'
    })

    return root
  }

  tree = visit(tree, schema)
  tree.required = schema.required !== false

  return tree
}
