const tape = require('tape')
const safeRegex = require('safe-regex')

const formats = require('../formats')

tape('safe-regex', function (t) {
  let key
  for (key in formats) {
    if (formats[key] instanceof RegExp) {
      t.ok(safeRegex(formats[key]), key + ' should be a safe regex')
    }
  }

  t.end()
})
