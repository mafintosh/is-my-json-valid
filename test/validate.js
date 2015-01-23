var tape = require('tape')
var fs = require('fs')
var cosmic = require('./fixtures/cosmic')
var validator = require('../')
var validatorRequire = require('../require')

tape('simple', function(t) {
  var schema = {
    required: true,
    type: 'object',
    properties: {
      hello: {type:'string', required:true}
    }
  }

  var validate = validator(schema)

  t.ok(validate({hello: 'world'}), 'should be valid')
  t.notOk(validate(), 'should be invalid')
  t.notOk(validate({}), 'should be invalid')
  t.end()
})

tape('advanced', function(t) {
  var validate = validator(cosmic.schema)

  t.ok(validate(cosmic.valid), 'should be valid')
  t.notOk(validate(cosmic.invalid), 'should be invalid')
  t.end()
})

tape('additional props', function(t) {
  var validate = validator({
    type: 'object',
    additionalProperties: false
  })

  t.ok(validate({}))
  t.notOk(validate({foo:'bar'}))
  t.end()
})

tape('array', function(t) {
  var validate = validator({
    type: 'array',
    required: true,
    items: {
      type: 'string'
    }
  })

  t.notOk(validate({}), 'wrong type')
  t.notOk(validate(), 'is required')
  t.ok(validate(['test']))
  t.end()
})

tape('nested array', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      list: {
        type: 'array',
        required: true,
        items: {
          type: 'string'
        }
      }
    }
  })

  t.notOk(validate({}), 'is required')
  t.ok(validate({list:['test']}))
  t.notOk(validate({list:[1]}))
  t.end()
})

tape('enum', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      foo: {
        type: 'number',
        required: true,
        enum: [42]
      }
    }
  })

  t.notOk(validate({}), 'is required')
  t.ok(validate({foo:42}))
  t.notOk(validate({foo:43}))
  t.end()
})

tape('minimum/maximum', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      foo: {
        type: 'number',
        minimum: 0,
        maximum: 0
      }
    }
  })

  t.notOk(validate({foo:-42}))
  t.ok(validate({foo:0}))
  t.notOk(validate({foo:42}))
  t.end()
})

tape('exclusiveMinimum/exclusiveMaximum', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      foo: {
        type: 'number',
        minimum: 10,
        maximum: 20,
        exclusiveMinimum: true,
        exclusiveMaximum: true
      }
    }
  })

  t.notOk(validate({foo:10}))
  t.ok(validate({foo:11}))
  t.notOk(validate({foo:20}))
  t.ok(validate({foo:19}))
  t.end()
})

var files = fs.readdirSync(__dirname+'/json-schema-draft4')
  .map(function(file) {
    if (file === 'definitions.json') return null
    if (file === 'refRemote.json') return null
    return require('./json-schema-draft4/'+file)
  })
  .filter(Boolean)

files.forEach(function(file) {
  file.forEach(function(f) {
    tape('json-schema-test-suite '+f.description, function(t) {
      var validate = validator(f.schema)
      f.tests.forEach(function(test) {
        t.same(validate(test.data), test.valid, test.description)
        if (test.error)
          t.same(validate.error, test.error, test.description)
      })
      t.end()
    })
  })
})
