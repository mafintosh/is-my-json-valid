const genobj = require('generate-object-property')
const jaystring = require('jaystring')
const genfun = require('./generate-function')
const jsonpointer = require('jsonpointer')
const formats = require('./formats')
const KNOWN_KEYWORDS = require('./known-keywords')

const get = function(obj, additionalSchemas, ptr) {
  var visit = function(sub) {
    if (sub && sub.id === ptr) return sub
    if (typeof sub !== 'object' || !sub) return null
    return Object.keys(sub).reduce(function(res, k) {
      return res || visit(sub[k])
    }, null)
  }

  const res = visit(obj)
  if (res) return res

  ptr = ptr.replace(/^#/, '')
  ptr = ptr.replace(/\/$/, '')

  try {
    return jsonpointer.get(obj, decodeURI(ptr))
  } catch (err) {
    const end = ptr.indexOf('#')
    let other
    // external reference
    if (end !== 0) {
      // fragment doesn't exist.
      if (end === -1) {
        other = additionalSchemas[ptr]
      } else {
        const ext = ptr.slice(0, end)
        other = additionalSchemas[ext]
        const fragment = ptr.slice(end).replace(/^#/, '')
        try {
          return jsonpointer.get(other, fragment)
        } catch (err) {}
      }
    } else {
      other = additionalSchemas[ptr]
    }
    return other || null
  }
}

const formatName = function(field) {
  field = JSON.stringify(field)
  // Commented out code from original vanilla version because it allows a code execution
  // exploit from a maliciously crafted schema.
  // var pattern = /\[([^\[\]"]+)\]/
  // while (pattern.test(field)) field = field.replace(pattern, '."+$1+"')
  return field
}

const types = {}

types.any = function() {
  return 'true'
}

types.null = function(name) {
  return name + ' === null'
}

types.boolean = function(name) {
  return 'typeof ' + name + ' === "boolean"'
}

types.array = function(name) {
  return 'Array.isArray(' + name + ')'
}

types.object = function(name) {
  return 'typeof ' + name + ' === "object" && ' + name + ' && !Array.isArray(' + name + ')'
}

types.number = function(name) {
  return 'typeof ' + name + ' === "number" && isFinite(' + name + ')'
}

types.integer = function(name) {
  return (
    'typeof ' +
    name +
    ' === "number" && (Math.floor(' +
    name +
    ') === ' +
    name +
    ' || ' +
    name +
    ' > 9007199254740992 || ' +
    name +
    ' < -9007199254740992)'
  )
}

types.string = function(name) {
  return 'typeof ' + name + ' === "string"'
}

const unique = function(array) {
  const list = []
  for (var i = 0; i < array.length; i++) {
    list.push(typeof array[i] === 'object' ? JSON.stringify(array[i]) : array[i])
  }
  for (var i = 1; i < list.length; i++) {
    if (list.indexOf(list[i]) !== i) return false
  }
  return true
}

const isMultipleOf = function(name, multipleOf) {
  let res
  const factor =
    (multipleOf | 0) !== multipleOf
      ? Math.pow(
          10,
          multipleOf
            .toString()
            .split('.')
            .pop().length
        )
      : 1
  if (factor > 1) {
    const factorName =
      (name | 0) !== name
        ? Math.pow(
            10,
            name
              .toString()
              .split('.')
              .pop().length
          )
        : 1
    if (factorName > factor) res = true
    else res = Math.round(factor * name) % (factor * multipleOf)
  } else res = name % multipleOf
  return !res
}

var compile = function(schema, cache, root, reporter, opts) {
  const fmts = opts ? Object.assign({}, formats, opts.formats) : formats
  const scope = { unique: unique, formats: fmts, isMultipleOf: isMultipleOf }
  const verbose = opts ? !!opts.verbose : false
  const greedy = opts && opts.greedy !== undefined ? opts.greedy : false

  const syms = {}
  const gensym = function(name) {
    return name + (syms[name] = (syms[name] || 0) + 1)
  }

  const reversePatterns = {}
  const patterns = function(p) {
    if (reversePatterns[p]) return reversePatterns[p]
    const n = gensym('pattern')
    scope[n] = new RegExp(p)
    reversePatterns[p] = n
    return n
  }

  const vars = ['i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'x', 'y', 'z']
  const genloop = function() {
    const v = vars.shift()
    vars.push(v + v[0])
    return v
  }

  var visit = function(name, node, reporter, filter, schemaPath) {
    if (node.constructor.toString() === Object.toString()) {
      Object.keys(node).forEach(function checkKeywordSupported(keyword) {
        if (!KNOWN_KEYWORDS.includes(keyword)) {
          throw new Error('Keyword not supported: ' + keyword)
        }
      })
    }

    let properties = node.properties
    let type = node.type
    let tuple = false

    if (Array.isArray(node.items)) {
      // tuple type
      properties = {}
      node.items.forEach(function(item, i) {
        properties[i] = item
      })
      type = 'array'
      tuple = true
    }

    let indent = 0
    const error = function(msg, prop, value) {
      validate('errors++')
      if (reporter === true) {
        validate('if (validate.errors === null) validate.errors = []')
        if (verbose) {
          validate(
            'validate.errors.push({field:%s,message:%s,value:%s,type:%s,schemaPath:%s})',
            formatName(prop || name),
            JSON.stringify(msg),
            value || name,
            JSON.stringify(type),
            JSON.stringify(schemaPath)
          )
        } else {
          validate(
            'validate.errors.push({field:%s,message:%s})',
            formatName(prop || name),
            JSON.stringify(msg)
          )
        }
      }
    }

    if (node.default !== undefined) {
      indent++
      validate('if (%s === undefined) {', name)('%s = %s', name, jaystring(node.default))(
        '} else {'
      )
    }

    if (node.required === true) {
      indent++
      validate('if (%s === undefined) {', name)
      error('is required')
      validate('} else {')
    } else {
      indent++
      validate('if (%s !== undefined) {', name)
    }

    const valid =
      []
        .concat(type)
        .map(function(t) {
          if (t && !types.hasOwnProperty(t)) {
            throw new Error('Unknown type: ' + t)
          }

          return types[t || 'any'](name)
        })
        .join(' || ') || 'true'

    if (valid !== 'true') {
      indent++
      validate('if (!(%s)) {', valid)
      error('is the wrong type')
      validate('} else {')
    }

    if (tuple) {
      if (node.additionalItems === false) {
        validate('if (%s.length > %d) {', name, node.items.length)
        error('has additional items')
        validate('}')
      } else if (node.additionalItems) {
        var i = genloop()
        validate('for (var %s = %d; %s < %s.length; %s++) {', i, node.items.length, i, name, i)
        visit(
          name + '[' + i + ']',
          node.additionalItems,
          reporter,
          filter,
          schemaPath.concat('additionalItems')
        )
        validate('}')
      }
    }

    if (node.format && fmts.hasOwnProperty(node.format)) {
      if (type !== 'string' && formats[node.format]) validate('if (%s) {', types.string(name))
      var n = gensym('format')
      scope[n] = fmts[node.format]

      if (scope[n] instanceof RegExp || typeof scope[n] === 'function') {
        const condition = scope[n] instanceof RegExp ? '!%s.test(%s)' : '!%s(%s)'
        validate('if (' + condition + ') {', n, name)
        error('must be ' + node.format + ' format')
        validate('}')
      } else if (typeof scope[n] === 'object') {
        visit(name, scope[n], reporter, filter, schemaPath.concat('format'))
      }

      if (type !== 'string' && formats[node.format]) validate('}')
    } else if (node.format) {
      throw new Error('Unrecognized format used')
    }

    if (Array.isArray(node.required)) {
      const checkRequired = function(req) {
        const prop = genobj(name, req)
        validate('if (%s === undefined) {', prop)
        error('is required', prop)
        validate('missing++')
        validate('}')
      }
      validate('if ((%s)) {', type !== 'object' ? types.object(name) : 'true')
      validate('var missing = 0')
      node.required.map(checkRequired)
      validate('}')
      if (!greedy) {
        validate('if (missing === 0) {')
        indent++
      }
    }

    if (node.uniqueItems) {
      if (type !== 'array') validate('if (%s) {', types.array(name))
      validate('if (!(unique(%s))) {', name)
      error('must be unique')
      validate('}')
      if (type !== 'array') validate('}')
    }

    if (node.enum) {
      const complex = node.enum.some(function(e) {
        return typeof e === 'object'
      })

      const compare = complex
        ? function(e) {
            return 'JSON.stringify(' + name + ')' + ' !== JSON.stringify(' + JSON.stringify(e) + ')'
          }
        : function(e) {
            return name + ' !== ' + JSON.stringify(e)
          }

      validate('if (%s) {', node.enum.map(compare).join(' && ') || 'false')
      error('must be an enum value')
      validate('}')
    }

    if (node.dependencies) {
      if (type !== 'object') validate('if (%s) {', types.object(name))

      Object.keys(node.dependencies).forEach(function(key) {
        let deps = node.dependencies[key]
        if (typeof deps === 'string') deps = [deps]

        const exists = function(k) {
          return genobj(name, k) + ' !== undefined'
        }

        if (Array.isArray(deps)) {
          validate(
            'if (%s !== undefined && !(%s)) {',
            genobj(name, key),
            deps.map(exists).join(' && ') || 'true'
          )
          error('dependencies not set')
          validate('}')
        }
        if (typeof deps === 'object') {
          validate('if (%s !== undefined) {', genobj(name, key))
          visit(name, deps, reporter, filter, schemaPath.concat(['dependencies', key]))
          validate('}')
        }
      })

      if (type !== 'object') validate('}')
    }

    if (node.additionalProperties || node.additionalProperties === false) {
      if (type !== 'object') validate('if (%s) {', types.object(name))

      var i = genloop()
      var keys = gensym('keys')

      const toCompare = function(p) {
        return keys + '[' + i + '] !== ' + JSON.stringify(p)
      }

      const toTest = function(p) {
        return '!' + patterns(p) + '.test(' + keys + '[' + i + '])'
      }

      const additionalProp =
        Object.keys(properties || {})
          .map(toCompare)
          .concat(Object.keys(node.patternProperties || {}).map(toTest))
          .join(' && ') || 'true'

      validate('var %s = Object.keys(%s)', keys, name)(
        'for (var %s = 0; %s < %s.length; %s++) {',
        i,
        i,
        keys,
        i
      )('if (%s) {', additionalProp)

      if (node.additionalProperties === false) {
        if (filter) validate('delete %s', name + '[' + keys + '[' + i + ']]')
        error(
          'has additional properties',
          null,
          JSON.stringify(name + '.') + ' + ' + keys + '[' + i + ']'
        )
      } else {
        visit(
          name + '[' + keys + '[' + i + ']]',
          node.additionalProperties,
          reporter,
          filter,
          schemaPath.concat(['additionalProperties'])
        )
      }

      validate('}')('}')

      if (type !== 'object') validate('}')
    }

    if (node.$ref) {
      const sub = get(root, (opts && opts.schemas) || {}, node.$ref)
      if (sub) {
        let fn = cache[node.$ref]
        if (!fn) {
          cache[node.$ref] = function proxy(data) {
            return fn(data)
          }
          fn = compile(sub, cache, root, false, opts)
        }
        var n = gensym('ref')
        scope[n] = fn
        validate('if (!(%s(%s))) {', n, name)
        error('referenced schema does not match')
        validate('}')
      }
    }

    if (node.not) {
      var prev = gensym('prev')
      validate('var %s = errors', prev)
      visit(name, node.not, false, filter, schemaPath.concat('not'))
      validate('if (%s === errors) {', prev)
      error('negative schema matches')
      validate('} else {')('errors = %s', prev)('}')
    }

    if (node.items && !tuple) {
      if (type !== 'array') validate('if (%s) {', types.array(name))

      var i = genloop()
      validate('for (var %s = 0; %s < %s.length; %s++) {', i, i, name, i)
      visit(name + '[' + i + ']', node.items, reporter, filter, schemaPath.concat('items'))
      validate('}')

      if (type !== 'array') validate('}')
    }

    if (node.patternProperties) {
      if (type !== 'object') validate('if (%s) {', types.object(name))
      var keys = gensym('keys')
      var i = genloop()
      validate('var %s = Object.keys(%s)', keys, name)(
        'for (var %s = 0; %s < %s.length; %s++) {',
        i,
        i,
        keys,
        i
      )

      Object.keys(node.patternProperties).forEach(function(key) {
        const p = patterns(key)
        validate('if (%s.test(%s)) {', p, keys + '[' + i + ']')
        visit(
          name + '[' + keys + '[' + i + ']]',
          node.patternProperties[key],
          reporter,
          filter,
          schemaPath.concat(['patternProperties', key])
        )
        validate('}')
      })

      validate('}')
      if (type !== 'object') validate('}')
    }

    if (node.pattern) {
      const p = patterns(node.pattern)
      if (type !== 'string') validate('if (%s) {', types.string(name))
      validate('if (!(%s.test(%s))) {', p, name)
      error('pattern mismatch')
      validate('}')
      if (type !== 'string') validate('}')
    }

    if (node.allOf) {
      node.allOf.forEach(function(sch, key) {
        visit(name, sch, reporter, filter, schemaPath.concat(['allOf', key]))
      })
    }

    if (node.anyOf && node.anyOf.length) {
      var prev = gensym('prev')

      node.anyOf.forEach(function(sch, i) {
        if (i === 0) {
          validate('var %s = errors', prev)
        } else {
          validate('if (errors !== %s) {', prev)('errors = %s', prev)
        }
        visit(name, sch, false, false, schemaPath)
      })
      node.anyOf.forEach(function(sch, i) {
        if (i) validate('}')
      })
      validate('if (%s !== errors) {', prev)
      error('no schemas match')
      validate('}')
    }

    if (node.oneOf && node.oneOf.length) {
      var prev = gensym('prev')
      const passes = gensym('passes')

      validate('var %s = errors', prev)('var %s = 0', passes)

      node.oneOf.forEach(function(sch, i) {
        visit(name, sch, false, false, schemaPath)
        validate('if (%s === errors) {', prev)('%s++', passes)('} else {')('errors = %s', prev)('}')
      })

      validate('if (%s !== 1) {', passes)
      error('no (or more than one) schemas match')
      validate('}')
    }

    if (node.multipleOf !== undefined) {
      if (type !== 'number' && type !== 'integer') validate('if (%s) {', types.number(name))

      validate('if (!isMultipleOf(%s, %d)) {', name, node.multipleOf)

      error('has a remainder')
      validate('}')

      if (type !== 'number' && type !== 'integer') validate('}')
    }

    if (node.maxProperties !== undefined) {
      if (type !== 'object') validate('if (%s) {', types.object(name))

      validate('if (Object.keys(%s).length > %d) {', name, node.maxProperties)
      error('has more properties than allowed')
      validate('}')

      if (type !== 'object') validate('}')
    }

    if (node.minProperties !== undefined) {
      if (type !== 'object') validate('if (%s) {', types.object(name))

      validate('if (Object.keys(%s).length < %d) {', name, node.minProperties)
      error('has less properties than allowed')
      validate('}')

      if (type !== 'object') validate('}')
    }

    if (node.maxItems !== undefined) {
      if (type !== 'array') validate('if (%s) {', types.array(name))

      validate('if (%s.length > %d) {', name, node.maxItems)
      error('has more items than allowed')
      validate('}')

      if (type !== 'array') validate('}')
    }

    if (node.minItems !== undefined) {
      if (type !== 'array') validate('if (%s) {', types.array(name))

      validate('if (%s.length < %d) {', name, node.minItems)
      error('has less items than allowed')
      validate('}')

      if (type !== 'array') validate('}')
    }

    if (node.maxLength !== undefined) {
      if (type !== 'string') validate('if (%s) {', types.string(name))

      validate('if (%s.length > %d) {', name, node.maxLength)
      error('has longer length than allowed')
      validate('}')

      if (type !== 'string') validate('}')
    }

    if (node.minLength !== undefined) {
      if (type !== 'string') validate('if (%s) {', types.string(name))

      validate('if (%s.length < %d) {', name, node.minLength)
      error('has less length than allowed')
      validate('}')

      if (type !== 'string') validate('}')
    }

    if (node.minimum !== undefined) {
      if (type !== 'number' && type !== 'integer') validate('if (%s) {', types.number(name))

      validate('if (%s %s %d) {', name, node.exclusiveMinimum ? '<=' : '<', node.minimum)
      error('is less than minimum')
      validate('}')

      if (type !== 'number' && type !== 'integer') validate('}')
    }

    if (node.maximum !== undefined) {
      if (type !== 'number' && type !== 'integer') validate('if (%s) {', types.number(name))

      validate('if (%s %s %d) {', name, node.exclusiveMaximum ? '>=' : '>', node.maximum)
      error('is more than maximum')
      validate('}')

      if (type !== 'number' && type !== 'integer') validate('}')
    }

    if (properties) {
      Object.keys(properties).forEach(function(p) {
        if (Array.isArray(type) && type.indexOf('null') !== -1) validate('if (%s !== null) {', name)

        visit(
          genobj(name, p),
          properties[p],
          reporter,
          filter,
          schemaPath.concat(tuple ? p : ['properties', p])
        )

        if (Array.isArray(type) && type.indexOf('null') !== -1) validate('}')
      })
    }

    while (indent--) validate('}')
  }

  var validate = genfun('function validate(data) {')(
    // Since undefined is not a valid JSON value, we coerce to null and other checks will catch this
    'if (data === undefined) data = null'
  )('validate.errors = null')('var errors = 0')

  visit('data', schema, reporter, opts && opts.filter, [])

  validate('return errors === 0')('}')

  const generatedFunc = validate
  const filteredScope = filterScope(generatedFunc.toString(), scope)

  validate = generatedFunc.toFunction(filteredScope)
  validate.toModule = function() {
    return generatedFunc.toModule(filteredScope)
  }
  validate.errors = null

  if (Object.defineProperty) {
    Object.defineProperty(validate, 'error', {
      get: function() {
        if (!validate.errors) return ''
        return validate.errors
          .map(function(err) {
            return err.field + ' ' + err.message
          })
          .join('\n')
      },
    })
  }

  validate.toJSON = function() {
    return schema
  }

  return validate
}

module.exports = function(schema, opts) {
  if (typeof schema === 'string') schema = JSON.parse(schema)
  return compile(schema, {}, schema, true, opts)
}

module.exports.filter = function(schema, opts) {
  const validate = module.exports(schema, Object.assign({}, opts, { filter: true }))
  return function(sch) {
    validate(sch)
    return sch
  }
}

// Improve performance of generated IIFE modules by filtering unneeded scope
function filterScope(source, scope) {
  const filtered = {}
  Object.keys(scope).forEach(function(key) {
    if (source.includes(key)) {
      filtered[key] = scope[key]
    }
  })
  return filtered
}
