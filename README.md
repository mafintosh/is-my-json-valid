# is-my-json-valid

A [JSONSchema](http://json-schema.org/) validator that uses code generation
to be extremely fast

```
npm install is-my-json-valid
```

It passes the entire JSONSchema v4 test suite except for `remoteRefs` and `maxLength`/`minLength` when using unicode surrogate pairs.

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
```

## Custom formats

is-my-json-valid supports the formats specified in JSON schema v4 (such as date-time).
If you want to add your own custom formats pass them as the formats options to the validator

``` js
var validate = validator({
  type: 'string',
  required: true,
  format: 'only-a'
}, {
  formats: {
    'only-a': /^a+$/
  }
})

console.log(validate('aa')) // true
console.log(validate('ab')) // false
```

## External schemas

You can pass in external schemas that you reference using the `$ref` attribute as the `schemas` option

``` js
var ext = {
  required: true,
  type: 'string'
}

var schema = {
  $ref: '#ext' // references another schema called ext
}

// pass the external schemas as an option
var validate = validator(schema, {schemas: {ext: ext}})

validate('hello') // returns true
validate(42) // return false
```

## Filtering away additional properties

is-my-json-valid supports filtering away properties not in the schema

``` js
var filter = validator.filter({
  required: true,
  type: 'object',
  properties: {
    hello: {type: 'string', required: true}
  },
  additionalProperties: false
})

var doc = {hello: 'world', notInSchema: true}
console.log(filter(doc)) // {hello: 'world'}
```

## Verbose mode outputs the value on errors

is-my-json-valid outputs the value causing an error when verbose is set to true

``` js
var validate = validator({
  required: true,
  type: 'object',
  properties: {
    hello: {
      required: true,
      type: 'string'
    }
  }
}, {
  verbose: true
})

validate({hello: 100});
console.log(validate.errors) // {field: 'data.hello', message: 'is the wrong type', value: 100}
```

## Greedy mode tries to validate as much as possible

By default is-my-json-valid bails on first validation error but when greedy is
set to true it tries to validate as much as possible:

``` js
var validate = validator({
  type: 'object',
  properties: {
    x: {
      type: 'number'
    }
  },
  required: ['x', 'y']
}, {
  greedy: true
});

validate({x: 'string'});
console.log(validate.errors) // [{field: 'data.y', message: 'is required'},
                             //  {field: 'data.x', message: 'is the wrong type'}]
```

## Custom data types and coercers

is-my-json-valid supports custom data types and coercers through the `validator.types` property. This can be useful for working with objects that must have values of types not represented in standard JSON.

For example, MongoDB queries using the `_id` field require the query document field value to be an instance of MongoDB's `ObjectId` class. Generally these are represented in JSON as a 24-character hex string, but must be converted to an `ObjectId` before being used in a query.

Supporting the `ObjectId` type in validation and coercing those fields into `ObjectId` instances takes two steps:
``` js
// Step 1: Make Mongo's ObjectId class global. Note that the Node JS driver for MongoDB calls the
// class ObjectID (with a capital D), but here we set it in GLOBAL using MongoDB's spelling, ObjectId.
GLOBAL.ObjectId = require('mongodb').ObjectID;

// Step 2: Add a custom type validator called ObjectId that also coerces.
// It returns a string that makes up a condition of an if clause.
// All work must be performed in one statement.
// The logic is as follows:
//    Is the value a string of 24 hex characters?
//       YES: Change the field to an ObjectId and return it (truthy).
//       NO: Is the value a non-null object whos constructor is ObjectId?
//          YES: Return true.
//          NO: Return false.
validator.types.ObjectId = function(name) {
   return 'typeof '+name+' === "string" && /^[0-9a-f]{24}$/i.test('+name+') ? '+name+'=ObjectId('+name+') : '+name+' && '+name+'.constructor===ObjectId';
};
```
The type **`"ObjectId"`** is now avaialable for use in schemas. For example:
``` js
// Create a schema, using the new ObjectId type for the _id property.
var querySchema={
   required : true,
   type : "object",
   properties : {
      _id : {
         required : true,
         type : "ObjectId"
      }
   },
   additionalProperties : false
};

// Create a validator for the schema.
var validateQuery=validator(querySchema);

// Create a query document with _id as a string.
var queryDoc={ _id : "56b98ca35c55e4a8061a92d8" };
console.log("[START] typeof _id:"+typeof(queryDoc._id)+" value:"+queryDoc._id);

// Now call the validator with query document.
var isValid=validateQuery(queryDoc);
console.log("[FIRST] isValid:"+isValid+" typeof _id:"+typeof(queryDoc._id)+" value:"+queryDoc._id);
// isValid is true, and queryDoc._id is now of type ObjectId.

// Test the validation against the query document in its new form as well.
var isAlsoValid=validateQuery(queryDoc);
console.log("[SECOND] isAlsoValid:"+isAlsoValid+" typeof _id:"+typeof(queryDoc._id)+" value:"+queryDoc._id);
// isAlsoValid is also true.

// Try a bad _id string.
queryDoc._id="56b95"; // Too short!
var isValidNow=validateQuery(queryDoc);
console.log("[THIRD] isValidNow:"+isValidNow+" typeof _id:"+typeof(queryDoc._id)+" value:"+queryDoc._id);
// isValidNow is false, and queryDoc._id is still the unchanged string.
```
The console will show:
```
[START] typeof _id:string value:56b98ca35c55e4a8061a92d8
[FIRST] isValid:true typeof _id:object value:56b98ca35c55e4a8061a92d8
[SECOND] isAlsoValid:true typeof _id:object value:56b98ca35c55e4a8061a92d8
[THIRD] isValidNow:false typeof _id:string value:56b95
```
## Performance

is-my-json-valid uses code generation to turn your JSON schema into basic javascript code that is easily optimizeable by v8.

At the time of writing, is-my-json-valid is the __fastest validator__ when running

* [json-schema-benchmark](https://github.com/Muscula/json-schema-benchmark)
* [cosmicreals.com benchmark](http://cosmicrealms.com/blog/2014/08/29/benchmark-of-node-dot-js-json-validation-modules-part-3/)
* [jsck benchmark](https://github.com/pandastrike/jsck/issues/72#issuecomment-70992684)
* [themis benchmark](https://cdn.rawgit.com/playlyfe/themis/master/benchmark/results.html)
* [z-schema benchmark](https://rawgit.com/zaggino/z-schema/master/benchmark/results.html)

If you know any other relevant benchmarks open a PR and I'll add them.

## License

MIT
