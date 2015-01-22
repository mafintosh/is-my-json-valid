# is-my-json-valid

A [JSONSchema](http://json-schema.org/) validator that uses code generation
to be extremely fast

```
npm install is-my-json-valid
```

It supports passes the entire JSONSchema v4 test suite except for `remoteRefs` and `maxLength` and `minLength` with the use of unicode surrogate pairs.

[![build status](http://img.shields.io/travis/mafintosh/is-my-json-valid.svg?style=flat)](http://travis-ci.org/mafintosh/is-my-json-valid)

## Usage

Simply pass a schema to compile it

``` js
var validator = require('is-my-json-valid')

var validate = validator({
  required: true,
  type: 'object',
  properties: {
    hello: {
      required: true,
      type: 'string'
    }
  }
})

console.log('should be valid', validate({hello: 'world'}))
console.log('should not be valid', validate({}))

// get the last list of errors by checking validate.errors
// the following will print [{field: 'data.hello', message: 'is required'}]
console.log(validate.errors)
```

You can also pass the schema as a string

``` js
var validate = validate('{"type": ... }')
```

Optionally you can use the require submodule to load a schema from `__dirname`

``` js
var validator = require('is-my-json-valid/require')
var validate = validator('my-schema.json')

// or load a orderly schema

var validate = validator('my-orderly-schema.schema')
```

## Performance

This is module is *fast*

When running the [cosmicrealms.com benchmark](http://cosmicrealms.com/blog/2014/02/07/benchmark-of-node-dot-js-json-validation-modules-part-2/) it yields
the following results on my macbook air

```
is-my-json-valid v4 total time (632) and per document time: 0.00316
amanda v3 total time (27121) and per document time: 1.35605
jayschema v4 total time (99449) and per document time: 4.97245
joi v3 total time (11949) and per document time: 0.59745
json-gate v3 total time (1443) and per document time: 0.07215
json-schema v3 total time (1318) and per document time: 0.0659
JSV v3 total time (33495) and per document time: 1.67475
schema v2 total time (1309) and per document time: 0.06545
tv4 v4 total time (703) and per document time: 0.03515
z-schema v4 total time (3188) and per document time: 0.1594
```

As seen above `is-my-json-valid` is 2500x faster than the slowest and ~20x faster than the second fastest

## License

MIT
