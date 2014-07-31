# is-my-json-valid

A [JSONSchema](http://json-schema.org/)/[orderly](http://orderly-json.org/) validator that uses code generation
to be extremely fast

```
npm install is-my-json-valid
```

## Usage

Simply pass a schema to compile it

``` js
var validator = require('is-my-json-valid')

var validate = validator({
  type: 'object',
  properties: {
    hello: {
      required: true,
      type: 'string'
    }
  }
})

console.log('should be valid', validate({hello: 'world'}))
console.log('should not be valid', validate())
```

You can also pass the schema as a string

``` js
var validate = validate('{"type": ... }')
```

Or pass a orderly schema

``` js
var validate = validate(
  'object {'+
  '  string name;'+
  '}*;'
)
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
is-my-json-fast v4 total time (3881) and per document time: 0.0019405 <-- or 2500x faster than jayschema
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

## License

MIT