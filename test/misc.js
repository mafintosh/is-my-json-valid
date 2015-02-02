var tape = require('tape')
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

tape('custom format', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      foo: {
        type: 'string',
        format: 'as'
      }
    }
  }, {formats: {as:/^a+$/}})

  t.notOk(validate({foo:''}), 'not as')
  t.notOk(validate({foo:'b'}), 'not as')
  t.notOk(validate({foo:'aaab'}), 'not as')
  t.ok(validate({foo:'a'}), 'as')
  t.ok(validate({foo:'aaaaaa'}), 'as')
  t.end()
})

tape('custom format function', function(t) {
  var validate = validator({
    type: 'object',
    properties: {
      foo: {
        type: 'string',
        format: 'as'
      }
    }
  }, {formats: {as:function(s) { return /^a+$/.test(s) } }})

  t.notOk(validate({foo:''}), 'not as')
  t.notOk(validate({foo:'b'}), 'not as')
  t.notOk(validate({foo:'aaab'}), 'not as')
  t.ok(validate({foo:'a'}), 'as')
  t.ok(validate({foo:'aaaaaa'}), 'as')
  t.end()
})

tape('do not mutate schema', function(t) {
  var sch = {
    items: [
      {}
    ],
    additionalItems: {
      type: 'integer'
    }
  }

  var copy = JSON.parse(JSON.stringify(sch))

  validator(sch)

  t.same(sch, copy, 'did not mutate')
  t.end()
})

tape('primitives', function(t) {
  var schema = {
    type: 'object',
    properties: {
      foo: {type:'string'},
      bar: {type:'number'},
      baz: {type:'boolean'}
    }
  }

  var validate = validator(schema)

  t.ok(validate({foo: new String('world')}), 'should be valid')
  t.ok(validate({foo: new Object('world')}), 'should be valid')
  t.ok(validate({bar: new Number(0)}), 'should be valid')
  t.ok(validate({bar: new Object(0)}), 'should be valid')
  t.ok(validate({baz: new Boolean(true)}), 'should be valid')
  t.ok(validate({baz: new Boolean(false)}), 'should be valid')
  t.ok(validate({baz: new Object(true)}), 'should be valid')
  t.ok(validate({baz: new Object(false)}), 'should be valid')
  t.end()
})
