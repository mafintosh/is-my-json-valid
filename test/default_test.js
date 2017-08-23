var tape = require('tape');
var validator = require('../');

tape('default on object', function(t) {
  var schema = {
    type: 'object',
    properties: {
      hello: {
        type: 'string',
        default: 'world'
      }
    }
  };

  var validate = validator(schema, {
    setDefault:   true
  });
  var value = {};

  t.ok(validate(value), 'should be valid');
  t.deepEqual(value, {hello: 'world'}, 'should set default');
  t.end();
});

tape('default on tuple', function(t) {
  var schema = {
    type: 'array',
    items: [
      {
        type: 'string',
        default: 'val1'
      }, {
        type: 'string',
        default: 'val2'
      }
    ]
  };

  var validate = validator(schema, {
    setDefault:   true
  });
  var value = [];

  t.ok(validate(value), 'should be valid');
  t.deepEqual(value, ['val1', 'val2'], 'should set default');
  t.end();
});

tape('nested default value', function(t) {
  var schema = {
    type: 'object',
    properties: {
      obj: {
        type: 'object',
        properties: {
          prop1: {type: 'string', default: 'val1'},
          prop2: {type: 'string'}
        },
        default: {prop2: 'val2'},
        required: ['prop2']
      }
    }
  };

  var validate = validator(schema, {
    setDefault:   true
  });

  var value = {};
  t.ok(validate(value), 'should be valid');
  t.deepEqual(value, {
    obj: {prop1: 'val1', prop2: 'val2'}
  }, 'should set default');

  var value = {obj: {prop1: 'val3', prop2: 'val4'}};
  t.ok(validate(value), 'should be valid');
  t.deepEqual(value, {
    obj: {prop1: 'val3', prop2: 'val4'}
  }, 'should override defaults');

  t.end();
});

tape('default on arrays', function(t) {
  var schema = {
    type: 'array',
    items: {
      type: 'string',
      default: 'val1'
    },
    additionalItems: {
      type: 'string',
      default: 'val2'
    }
  };

  var validate = validator(schema, {
    setDefault:   true
  });
  var value = [];

  t.ok(validate(value), 'should be valid');
  t.deepEqual(value, [], 'should set default');
  t.end();
});

tape('default on object (deactivated by default)', function(t) {
  var schema = {
    type: 'object',
    properties: {
      hello: {
        type: 'string',
        default: 'world'
      }
    }
  };

  var validate = validator(schema);
  var value = {};

  t.ok(validate(value), 'should be valid');
  t.deepEqual(value, {}, 'should not set default');
  t.end();
});
