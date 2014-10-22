var normalize = require('./normalize')
var formats = require('./formats')
var genobj = require('generate-object-property')
var genfun = require('generate-function')

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

var formatName = function(field) {
  return field.replace(/\[[^\]]+\]/g, '.*')
}

var types = {}

types.any = function() {
  return 'true'
}

types.null = function() {
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
  return 'typeof '+name+' === "number" && '+name+' | 0 === '+name
}

types.string = function(name) {
  return 'typeof '+name+' === "string"'
}

var unique = function(array) {
  for (var i = 1; i < array.length; i++) {
    if (array.indexOf(array[i]) !== i) return false
  }
  return true
}

var toType = function(node) {
  return node.type
}

var compile = function(sch) {
  var schema = normalize(sch)
  var scope = {unique:unique, formats:formats}

  var syms = {}
  var gensym = function(name) {
    return name+(syms[name] = (syms[name] || 0)+1)
  }

  var vars = ['i','j','k','l','m','n','o','p','q','r','s','t','u','v','x','y','z']
  var genloop = function() {
    var v = vars.shift()
    vars.push(v+v[0])
    return v
  }

  var visit = function(name, node) {
    var error = function(msg) {
      var n = gensym('error')
      scope[n] = {field:formatName(name), message:msg}
      validate
        ('if (validate.errors === null) validate.errors = []')
        ('validate.errors.push(%s)', n)
    }

    if (node.required) {
      if (node.nullable) validate('if (%s === undefined) {', name)
      else validate('if (%s === undefined || %s === null) {', name, name)
      error('is required')
      validate('} else {')
    } else {
      if (node.nullable) validate('if (%s !== undefined) {', name)
      else validate('if (%s !== undefined && %s !== null) {', name, name)
    }

    node.types.forEach(function(node, i) {
      var valid = types[node.type](name)

      if (i) validate('} else if (%s) {', valid)
      else validate('if (%s) {', valid)

      if (!node.conditions) validate('// do nothing - just type validate')

      if (node.values) {
        var toCompare = function(v) {
          return name+' !== '+JSON.stringify(v)
        }

        validate('if (%s) {', node.values.map(toCompare).join(' && ') || 'true')
        error('must be one of ['+node.values.join(', ')+']')
        validate('}')
        return
      }

      if (node.minimum !== undefined) {
        validate('if (%s < %d) {', name, node.minimum)
        error('must be more than '+node.minimum)
        validate('}')
      }

      if (node.maximum !== undefined) {
        validate('if (%s > %d) {', name, node.maximum)
        error('must be less than '+node.maximum)
        validate('}')
      }

      if (node.format && formats[node.format]) {
        var n = gensym('format')
        scope[n] = formats[node.format]

        validate('if (!%s.test(%s)) {', n, name)
        error('must be '+node.format+' format')
        validate('}')
      }

      if (node.pattern) {
        var n = gensym('pattern')
        scope[n] = new RegExp(node.pattern)

        validate('if (!%s.test(%s)) {', n, name)
        error('must match /'+node.pattern+'/')
        validate('}')
      }

      if (node.type === 'array') {
        if (node.minItems) {
          validate('if (%s.length < %d) {', name, node.minItems)
          error('must contain at least '+node.minItems+' item(s)')
          validate('}')
        }

        if (node.maxItems) {
          validate('if (%s.length > %d) {', name, node.maxItems)
          error('must contain at most '+node.minItems+' item(s)')
          validate('}')
        }

        if (node.uniqueItems) {
          validate('if (!unique(%s)) {', name)
          error('must only contain unique values')
          validate('}')
        }

        var i = genloop()
        validate('for (var %s = 0; %s < %s.length; %s++) {', i, i, name, i)
        visit(name+'['+i+']', node.items)
        validate('}')
      }

      if (node.type === 'object' && node.additionalProperties === false) {
        var i = genloop()
        var keys = gensym('keys')

        var toCompare = function(p) {
          return keys+'['+i+'] !== '+JSON.stringify(p)
        }

        validate
          ('var %s = Object.keys(%s)', keys, name)
          ('for (var %s = 0; %s < %s.length; %s++) {', i, i, keys, i)
            ('if (%s) {', Object.keys(node.properties).map(toCompare).join(' && ') || 'true')
              ('if (validate.errors === null) validate.errors = []')
              ('validate.errors.push({"field":"%s."+%s[i], "message":"is not defined in the schema"})', formatName(name), keys)
            ('}')
          ('}')
      }

      if (node.type === 'object') {
        Object.keys(node.properties).forEach(function(n) {
          visit(genobj(name, n), node.properties[n])
        })
      }
    })

    if (node.types.length) {
      validate('} else {')
      error('must be '+node.types.map(toType).map(a).join(' or '))
      validate('}')
    }

    validate('}')
  }

  var validate = genfun
    ('function validate(data) {')
      ('validate.errors = null')

  visit('data', schema)

  validate
      ('return validate.errors === null')
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

module.exports = compile
