var genobj = require('generate-object-property')
var genfun = require('generate-function')
var jsonpointer = require('jsonpointer')
var formats = require('./formats')

var a = function(type) {
  switch (type) {
    case 'array':
    case 'object':
    case 'integer':
    return 'an '+type

    default:
    return 'a '+type
  }
}

var get = function(obj, ptr) {
  if (/^https?:\/\//.test(ptr)) return null

  var visit = function(sub) {
    if (sub && sub.id === ptr) return sub
    if (typeof sub !== 'object' || !sub) return null
    return Object.keys(sub).reduce(function(res, k) {
      return res || visit(sub[k])
    }, null)
  }

  var res = visit(obj)
  if (res) return res

  ptr = ptr.replace(/^#/, '')
  ptr = ptr.replace(/\/$/, '')

  try {
    return jsonpointer.get(obj, decodeURI(ptr))
  } catch (err) {
    return null
  }
}

var formatName = function(field) {
  return field.replace(/\[[^\]]+\]/g, '.*')
}

var types = {}

types.any = function() {
  return 'true'
}

types.null = function(name) {
  return name+' === null'
}

types.boolean = function(name) {
  return 'typeof '+name+' === "boolean"'
}

types.array = function(name) {
  return 'Array.isArray('+name+')'
}

types.object = function(name) {
  return 'typeof '+name+' === "object" && '+name+' && !Array.isArray('+name+')'
}

types.number = function(name) {
  return 'typeof '+name+' === "number"'
}

types.integer = function(name) {
  return 'typeof '+name+' === "number" && (('+name+' | 0) === '+name+' || '+name+' > 9007199254740992 || '+name+' < -9007199254740992)'
}

types.string = function(name) {
  return 'typeof '+name+' === "string"'
}

var unique = function(array) {
  var list = []
  for (var i = 0; i < array.length; i++) {
    list.push(typeof array[i] === 'object' ? JSON.stringify(array[i]) : array[i])
  }
  for (var i = 1; i < list.length; i++) {
    if (list.indexOf(list[i]) !== i) return false
  }
  return true
}

var toType = function(node) {
  return node.type
}

var compile = function(schema, cache, root, reporter) {
  var scope = {unique:unique, formats:formats}

  var syms = {}
  var gensym = function(name) {
    return name+(syms[name] = (syms[name] || 0)+1)
  }

  var reversePatterns = {}
  var patterns = function(p) {
    if (reversePatterns[p]) return reversePatterns[p]
    var n = gensym('pattern')
    scope[n] = new RegExp(p)
    reversePatterns[p] = n
    return n
  }

  var vars = ['i','j','k','l','m','n','o','p','q','r','s','t','u','v','x','y','z']
  var genloop = function() {
    var v = vars.shift()
    vars.push(v+v[0])
    return v
  }

  var visit = function(name, node, reporter) {
    if (Array.isArray(node.items)) { // tuple type
      node.properties = {}
      node.items.forEach(function(item, i) {
        node.properties[i] = item
      })
      node.type = 'array'
      node.tuple = true
    }

    var indent = 0
    var error = function(msg) {
      if (reporter === false) {
        validate('errors++')
        return
      }

      var n = gensym('error')
      scope[n] = {field:formatName(name), message:msg}
      validate
        ('errors++')
        ('if (validate.errors === null) validate.errors = []')
        ('validate.errors.push(%s)', n)
    }

    if (node.required === true) {
      indent++
      validate('if (%s === undefined) {', name)
      error('is required')
      validate('} else {')
    } else if (node.required) {
      indent++

      var isUndefined = function(req) {
        return genobj(name, req) + ' === undefined'
      }

      validate('if (%s) {', node.required.map(isUndefined).join(' || ') || 'false')
      error('missing required properties')
      validate('} else {')
    } else {
      indent++
      validate('if (%s !== undefined) {', name)
    }

    var valid = [].concat(node.type)
      .map(function(t) {
        return types[t || 'any'](name)
      })
      .join(' || ') || 'true'

    if (valid !== 'true') {
      indent++
      validate('if (!(%s)) {', valid)
      error('is the wrong type')
      validate('} else {')
    }

    if (node.tuple) {
      if (node.additionalItems === false) {
        validate('if (%s.length > %d) {', name, node.items.length)
        error('has additional items')
        validate('}')
      } else if (node.additionalItems) {
        var i = genloop()
        validate('for (var %s = %d; %s < %s.length; %s++) {', i, node.items.length, i, name, i)
        visit(name+'['+i+']', node.additionalItems, reporter)
        validate('}')
      }   
    }

    if (node.format && formats[node.format]) {
      var n = gensym('format')
      scope[n] = formats[node.format]

      validate('if (!%s.test(%s)) {', n, name)
      error('must be '+node.format+' format')
      validate('}')
    }

    if (node.uniqueItems) {
      if (node.type !== 'array') validate('if (%s) {', types.array(name))
      validate('if (!(unique(%s))) {', name)
      error('must be unique')
      validate('}')
      if (node.type !== 'array') validate('}')
    }

    if (node.enum) {
      var complex = node.enum.some(function(e) {
        return typeof e === 'object'
      })

      var compare = complex ?
        function(e) {
          return 'JSON.stringify('+name+')'+' !== JSON.stringify('+JSON.stringify(e)+')'
        } :
        function(e) {
          return name+' !== '+JSON.stringify(e)
        }

      validate('if (%s) {', node.enum.map(compare).join(' && ') || 'false')
      error('must be an enum value')
      validate('}')
    }

    if (node.dependencies) {
      if (node.type !== 'object') validate('if (%s) {', types.object(name))

      Object.keys(node.dependencies).forEach(function(key) {
        var deps = node.dependencies[key]
        if (typeof deps === 'string') deps = [deps]

        var exists = function(k) {
          return genobj(name, k) + ' !== undefined'
        }

        if (Array.isArray(deps)) {
          validate('if (%s !== undefined && !(%s)) {', genobj(name, key), deps.map(exists).join(' && ') || 'true')
          error('dependencies not set')
          validate('}')
        }
        if (typeof deps === 'object') {
          validate('if (%s !== undefined) {', genobj(name, key))
          visit(name, deps, reporter)
          validate('}')
        }
      })

      if (node.type !== 'object') validate('}')      
    }

    if (node.additionalProperties || node.additionalProperties === false) {
      if (node.type !== 'object') validate('if (%s) {', types.object(name))

      var i = genloop()
      var keys = gensym('keys')

      var toCompare = function(p) {
        return keys+'['+i+'] !== '+JSON.stringify(p)
      }

      var toTest = function(p) {
        return '!'+patterns(p)+'.test('+keys+'['+i+'])'
      }

      var additionalProp = Object.keys(node.properties || {}).map(toCompare)
        .concat(Object.keys(node.patternProperties || {}).map(toTest))
        .join(' && ') || 'true'

      validate('var %s = Object.keys(%s)', keys, name)
        ('for (var %s = 0; %s < %s.length; %s++) {', i, i, keys, i)
          ('if (%s) {', additionalProp)

      if (node.additionalProperties === false) {
        error('has additional properties')
      } else {
        visit(name+'['+keys+'['+i+']]', node.additionalProperties, reporter)
      }

      validate
          ('}')
        ('}')

      if (node.type !== 'object') validate('}')
    }

    if (node.$ref) {
      var sub = get(root, node.$ref)
      if (sub) {
        var fn = cache[node.$ref]
        if (!fn) {
          cache[node.$ref] = function proxy(data) {
            return fn(data)
          }
          fn = compile(sub, cache, root, false)
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
      visit(name, node.not, false)
      validate('if (%s === errors) {', prev)
      error('negative schema matches')
      validate('} else {')
        ('errors = %s', prev)
      ('}')
    }

    if (node.items && !node.tuple) {
      if (node.type !== 'array') validate('if (%s) {', types.array(name))

      var i = genloop()
      validate('for (var %s = 0; %s < %s.length; %s++) {', i, i, name, i)
      visit(name+'['+i+']', node.items, reporter)
      validate('}')

      if (node.type !== 'array') validate('}')
    }

    if (node.patternProperties) {
      if (node.type !== 'object') validate('if (%s) {', types.object(name))
      var keys = gensym('keys')
      var i = genloop()
      validate
        ('var %s = Object.keys(%s)', keys, name)
        ('for (var %s = 0; %s < %s.length; %s++) {', i, i, keys, i)

      Object.keys(node.patternProperties).forEach(function(key) {
        var p = patterns(key)
        validate('if (%s.test(%s)) {', p, keys+'['+i+']')
        visit(name+'['+keys+'['+i+']]', node.patternProperties[key], reporter)
        validate('}')
      })

      validate('}')
      if (node.type !== 'object') validate('}')
    }

    if (node.pattern) {
      var p = patterns(node.pattern)
      if (node.type !== 'string') validate('if (%s) {', types.string(name))
      validate('if (!(%s.test(%s))) {', p, name)
      error('pattern mismatch')
      validate('}')
      if (node.type !== 'string') validate('}')
    }

    if (node.allOf) {
      node.allOf.forEach(function(sch) {
        visit(name, sch, reporter)
      })
    }

    if (node.anyOf && node.anyOf.length) {
      var prev = gensym('prev')

      node.anyOf.forEach(function(sch, i) {
        if (i === 0) {
          validate('var %s = errors', prev)
        } else {          
          validate('if (errors !== %s) {', prev)
            ('errors = %s', prev)
        }
        visit(name, sch, false)
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
      var passes = gensym('passes')

      validate
        ('var %s = errors', prev)
        ('var %s = 0', passes)

      node.oneOf.forEach(function(sch, i) {
        visit(name, sch, false)
        validate('if (%s === errors) {', prev)
          ('%s++', passes)
        ('} else {')
          ('errors = %s', prev)
        ('}')
      })

      validate('if (%s !== 1) {', passes)
      error('no (or more than one) schemas match')
      validate('}')
    }

    if (node.multipleOf !== undefined) {
      if (node.type !== 'number' && node.type !== 'integer') validate('if (%s) {', types.number(name))

      var factor = ((node.multipleOf | 0) !== node.multipleOf) ? Math.pow(10, node.multipleOf.toString().split('.').pop().length) : 1
      if (factor > 1) validate('if ((%d*%s) % %d) {', factor, name, factor*node.multipleOf)
      else validate('if (%s % %d) {', name, node.multipleOf)

      error('has a remainder')
      validate('}')

      if (node.type !== 'number' && node.type !== 'integer') validate('}')
    }

    if (node.maxProperties !== undefined) {
      if (node.type !== 'object') validate('if (%s) {', types.object(name))
      
      validate('if (Object.keys(%s).length > %d) {', name, node.maxProperties)
      error('has more properties than allowed')
      validate('}')

      if (node.type !== 'object') validate('}')      
    }

    if (node.minProperties !== undefined) {
      if (node.type !== 'object') validate('if (%s) {', types.object(name))
      
      validate('if (Object.keys(%s).length < %d) {', name, node.minProperties)
      error('has less properties than allowed')
      validate('}')

      if (node.type !== 'object') validate('}')      
    }

    if (node.maxItems !== undefined) {
      if (node.type !== 'array') validate('if (%s) {', types.array(name))
      
      validate('if (%s.length > %d) {', name, node.maxItems)
      error('has more items than allowed')
      validate('}')

      if (node.type !== 'array') validate('}')
    }

    if (node.minItems !== undefined) {
      if (node.type !== 'array') validate('if (%s) {', types.array(name))
      
      validate('if (%s.length < %d) {', name, node.minItems)
      error('has less items than allowed')
      validate('}')

      if (node.type !== 'array') validate('}')
    }

    if (node.maxLength !== undefined) {
      if (node.type !== 'string') validate('if (%s) {', types.string(name))

      validate('if (%s.length > %d) {', name, node.maxLength)
      error('has longer length than allowed')
      validate('}')

      if (node.type !== 'string') validate('}')
    }

    if (node.minLength !== undefined) {
      if (node.type !== 'string') validate('if (%s) {', types.string(name))

      validate('if (%s.length < %d) {', name, node.minLength)
      error('has less length than allowed')
      validate('}')

      if (node.type !== 'string') validate('}')
    }

    if (node.minimum !== undefined) {
      validate('if (%s %s %d) {', name, node.exclusiveMinimum ? '<=' : '<', node.minimum)
      error('is less than minimum')
      validate('}')
    }

    if (node.maximum !== undefined) {
      validate('if (%s %s %d) {', name, node.exclusiveMaximum ? '>=' : '>', node.maximum)
      error('is more than maximum')
      validate('}')
    }

    if (node.properties) {
      Object.keys(node.properties).forEach(function(p) {
        visit(genobj(name, p), node.properties[p], reporter)
        var def = node.properties[p].default
        if (def !== undefined) validate('if (%s === undefined) %s = %s', genobj(name, p), genobj(name, p), JSON.stringify(def))
      })
    }

    while (indent--) validate('}')
  }

  var validate = genfun
    ('function validate(data) {')
      ('validate.errors = null')
      ('var errors = 0')

  visit('data', schema, reporter)

  validate
      ('return errors === 0')
    ('}')

  validate = validate.toFunction(scope)
  validate.errors = null

  validate.__defineGetter__('error', function() {
    if (!validate.errors) return ''
    return validate.errors
      .map(function(err) {
        return err.field+' '+err.message
      })
      .join('\n')
  })

  validate.toJSON = function() {
    return sch
  }

  return validate
}

module.exports = function(schema) {
  if (typeof schema === 'string') schema = JSON.parse(schema)
  return compile(schema, {}, schema, true)
}