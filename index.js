var orderly = require('orderly')
var compile = require('./compile')

module.exports = function(schema) {
  if (Buffer.isBuffer(schema)) schema = schema.toString()

  if (typeof schema === 'string') {
    try {
      schema = orderly.parse(schema)
    } catch (err) {
      if (schema.trim()[0] !== '{') throw err
      schema = JSON.parse(schema)
    }
  }

  return compile(schema)
}