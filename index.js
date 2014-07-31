var orderly = require('orderly')
var compile = require('./compile')

module.exports = function(schema) {
  if (Buffer.isBuffer(schema)) schema = schema.toString()

  if (typeof schema === 'string') {
    try {
      schema = orderly.parse(schema)
    } catch (err) {
      schema = JSON.parse(schema)
    }
  }

  return compile(schema)
}