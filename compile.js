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

var formatName = function(field) {
  return field.replace(/\[[^\]]+\]/g, '.*')
}

var types = {}

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

var validators = {}

var compile = function(schema) {
  var scope = {unique:unique, errors:[]}

  var vars = ['i','j','k','l','m','n','o','p','q','r','s','t','u','v','x','y','z']
  var loopVar = function() {
    var v = vars.shift()
    vars.push(v+v[0])
    return v
  }

  var visit = function(name, node) {
    var type = node.type
    var enm = node.enum || (type && type.enum)
    var lvl = 1

    var error = function(msg) {
      var err = {
        field: formatName(name),
        message: msg
      }
      return 'errors['+(scope.errors.push(err)-1)+']'
    }

    var isNullType = [].concat(type).some(function(t) {
      return (t.type || t) === 'null'
    })

    if (node.required) {
      if (isNullType) validate('if (%s === undefined) {', name)
      else validate('if (%s === undefined || %s === null) {', name, name)

      validate
        ('if (validate.errors === null) validate.errors = []')
        ('validate.errors.push(%s)', error('is required'))
      ('} else {')
    } else {
      if (isNullType) validate('if (%s !== undefined) {', name)
      else validate('if (%s !== undefined && %s !== null) {', name, name)
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

      lvl++
      validate
        ('if (%s) {', invalid)
          ('if (validate.errors === null) validate.errors = []')
          ('validate.errors.push(%s)', error('must be '+msg))
        ('} else {')
    }

    if (enm) {
      var invalid = enm
        .map(function(e) {
          return name+' !== '+JSON.stringify(e)
        })
        .join(' && ')

      if (!invalid) invalid = 'true'

      lvl++
      validate
        ('if (%s) {', invalid)
          ('if (validate.errors === null) validate.errors = []')
          ('validate.errors.push(%s)', error('must be one of ['+enm.join(', ')+']'))
        ('} else {')
    }

    if (node.minimum) {
      validate
        ('if (%s < %d) {', name, node.minimum)
          ('if (validate.errors === null) validate.errors = []')
          ('validate.errors.push(%s)', error('must be more than '+node.minimum))
        ('}')
    }

    if (node.maximum) {
      validate
        ('if (%s > %d) {', name, node.maximum)
          ('if (validate.errors === null) validate.errors = []')
          ('validate.errors.push(%s)', error('must be less than '+node.maximum))
        ('}')
    }

    if (node.pattern) {
      var i = Object.keys(scope).length
      var p = new RegExp(node.pattern)
      scope['pattern'+i] = p

      validate
        ('if (!pattern%d.test(%s)) {', i, name)
          ('if (validate.errors === null) validate.errors = []')
          ('validate.errors.push(%s)', error('must match /'+node.pattern+'/'))
        ('}')
    }

    var items = node.items
    if (items && items[0]) items = items[0] // TODO: this is probably WRONG. investigate

    if (type === 'array') {
      if (node.minItems) {
        validate
          ('if (%s.length < %d) {', name, node.minItems)
            ('if (validate.errors === null) validate.errors = []')
            ('validate.errors.push(%s)', error('must contain at least '+node.minItems+' item(s)'))
          ('}')
      }
      if (node.maxItems) {
        validate
          ('if (%s.length > %d) {', name, node.maxItems)
            ('if (validate.errors === null) validate.errors = []')
            ('validate.errors.push(%s)', error('must contain at most '+node.minItems+' item(s)'))
          ('}')
      }
      if (node.uniqueItems) {
        validate
          ('if (!unique(%s)) {', name)
            ('if (validate.errors === null) validate.errors = []')
            ('validate.errors.push(%s)', error('must only contain unique values'))
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
            ('if (validate.errors === null) validate.errors = []')
            ('validate.errors.push({"field":"%s."+keys[i], "message":"is not defined in the schema"})', formatName(name))
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

    while (lvl--) validate('}')
  }

  var validate = genfun()
    ('function validate(data) {')
      ('validate.errors = null')

  schema.required = schema.required !== false
  visit('data', schema)

  validate()
    ('return validate.errors === null')
  ('}')

  validate = validate.trim().toFunction(scope)

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
    return schema
  }

  return validate
}

module.exports = compile