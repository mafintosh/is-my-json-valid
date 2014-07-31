var genfun = require('generate-function')
var genobj = require('generate-object-property')

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

var defined = {}

var defined = function(name) {
  return name+' !== null && '+name+' !== undefined'
}

var types = {}

types.boolean = function(name) {
  return 'typeof '+name+' === "boolean"'
}

types.array = function(name) {
  return 'Array.isArray('+name+')'
}

types.object = function(name) {
  return 'typeof '+name+' === "object" && !Array.isArray('+name+')'
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

var validators = {}

var compile = function(schema) {
  var scope = {unique:unique}

  var vars = ['i','j','k','l','m','n','o','p','q','r','s','t','u','v','x','y','z']
  var loopVar = function() {
    var v = vars.shift()
    vars.push(v+v[0])
    return v
  }

  var visit = function(name, node) {
    var type = node.type
    var enm = node.enum || (type && type.enum)

    if (node.required) {
      validate()
        ('if (!(%s)) {', defined(name))
          ('validate.error = %s', JSON.stringify(name+' is required'))
          ('return false')
        ('}')
    } else {
      validate()
        ('if (%s) {', defined(name))
    }

    if (type) {
      var msg = [].concat(type)
        .map(function(t) {
          return t.type || t
        })
        .map(a)
        .join(' or ')

      var invalid = [].concat(type)
        .map(function(t) {
          return t.type || t
        })
        .map(function(t) {
          return '!('+types[t](name)+')'
        })
        .join(' && ')

      if (!invalid) invalid = 'true'

      validate()
        ('if (%s) {', invalid)
          ('validate.error = %s', JSON.stringify(name+' must be '+msg))
          ('return false')
        ('}')
    }

    if (enm) {
      var invalid = enm
        .map(function(e) {
          return name+' !== '+JSON.stringify(e)
        })
        .join(' && ')

      if (!invalid) invalid = 'true'

      validate
        ('if (%s) {', invalid)
          ('validate.error = %s', JSON.stringify(name+' must be one of ['+enm.join(', ')+']'))
          ('return false')
        ('}')
    }

    if (node.minimum) {
      validate
        ('if (%s < %d) {', name, node.minimum)
          ('validate.error = %s', JSON.stringify(name+' must be more than '+node.minimum))
          ('return false')
        ('}')
    }

    if (node.maximum) {
      validate
        ('if (%s > %d) {', name, node.maximum)
          ('validate.error = %s', JSON.stringify(name+' must be less than '+node.maximum))
          ('return false')
        ('}')
    }

    if (node.pattern) {
      var i = Object.keys(scope).length
      var p = new RegExp(node.pattern)
      scope['pattern'+i] = p

      validate
        ('if (!pattern%d.test(%s)) {', i, name)
          ('validate.error = %s', JSON.stringify(name+' must match /'+node.pattern+'/'))
          ('return false')
        ('}')
    }

    var items = node.items
    if (items && items[0]) items = items[0] // TODO: this is probably WRONG. investigate

    if (type === 'array') {
      if (node.minItems) {
        validate
          ('if (%s.length < %d) {', name, node.minItems)
            ('validate.error = %s', JSON.stringify(name+' must contain at least '+node.minItems+' item(s)'))
          ('}')
      }
      if (node.maxItems) {
        validate
          ('if (%s.length > %d) {', name, node.maxItems)
            ('validate.error = %s', JSON.stringify(name+' must contain at most '+node.minItems+' item(s)'))
          ('}')
      }
      if (node.uniqueItems) {
        validate
          ('if (!unique(%s)) {', name)
            ('validate.error = %s', JSON.stringify(name+' must only contain unique values'))
            ('return false')
          ('}')
      }

      var i = loopVar()
      validate('for (var '+i+' = 0; '+i+' < %s.length; '+i+'++) {', name)
      visit(name+'['+i+']', items)
      validate('}')
    }

    if (node.additionalProperties === false && node.type === 'object') {
      var i = loopVar()
      var invalid = Object.keys(node.properties)
        .map(function(p) {
          return 'keys['+i+'] !== '+JSON.stringify(p)
        })
        .join(' && ')

      if (!invalid) invalid = 'true'

      validate('var keys = Object.keys(%s)', name)
        ('for (var '+i+' = 0; '+i+' < keys.length; '+i+'++) {')
          ('if (%s) {', invalid)
            ('valid.error = keys['+i+'] + " is not allowed"')
            ('return false')
          ('}')
        ('}')
    }


    if (node.properties) {
      Object.keys(node.properties).forEach(function(n) {
        var pname = genobj(name, n)
        var prop = node.properties[n]
        if (Array.isArray(node.required)) prop.required = node.required.indexOf(n) > -1
        visit(pname, prop)
      })
    }

    if (!node.required) validate('}')
  }

  var validate = genfun()
    ('function validate(data) {')
      ('validate.error = ""')

  schema.required = schema.required !== false
  visit('data', schema)

  validate()
    ('return true')
  ('}')

  validate = validate.toFunction(scope)
  validate.error = ''

  return validate
}

module.exports = compile