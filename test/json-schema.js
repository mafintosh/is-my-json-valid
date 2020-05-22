const tape = require('tape')
const fs = require('fs')
const validator = require('../')

const files = fs.readdirSync(__dirname+'/json-schema-draft4')
  .map(function(file) {
    if (file === 'definitions.json') return null
    if (file === 'refRemote.json') return null
    if (file === 'ref.json') return null
    return require('./json-schema-draft4/'+file)
  })
  .filter(Boolean)

files.forEach(function(file) {
  file.forEach(function(f) {
    tape('json-schema-test-suite '+f.description, function(t) {
      const validate = validator(f.schema)
      f.tests.forEach(function(test) {
        t.same(validate(test.data), test.valid, test.description)
      })
      t.end()
    })
  })
})
