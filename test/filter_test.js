var tape = require('tape');
var validator = require('../');

tape('filter with {additionalProperties: false}', function(t) {
  t.plan(2);

  var schema = {
    type: 'object',
    properties: {
      prop: {type:  'string'}
    },
    additionalProperties: false
  };

  var validate = validator(schema, {
    filter:     true
  });

  var value = {
    prop:   'my-value',
    extra:  'should be filtered out'
  };

  t.ok(validate(value), 'should be valid, as we have {filter: true}');
  t.deepEqual(value, {prop: 'my-value'}, 'should filter properties');
});

tape('{filter: true} still produces errors', function(t) {
  t.plan(2);

  var schema = {
    type: 'object',
    properties: {
      prop: {type:  'string'}
    },
    required: ['prop'],
    additionalProperties: false
  };

  var validate = validator(schema, {
    filter:     true
  });

  var value = {
    extra:  'should be filtered out'
  };

  t.notOk(validate(value), 'should not be valid');
  t.ok(validate.errors instanceof Array &&
       validate.errors.length > 0, 'should have errors');
});
