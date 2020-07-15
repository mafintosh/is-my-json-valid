const tape = require('tape')
const validator = require('..')

tape('required + uniqueItems', (t) => {
  const validate = validator({ required: ['a'], uniqueItems: true })
  t.notOk(validate([1, 1]), 'required + uniqueItems')
  t.end()
})

tape('required + uniqueItems inside allOf', (t) => {
  const validate = validator({
    required: ['a'],
    allOf: [
      { required: ['b'], uniqueItems: true }
    ]
  })
  t.notOk(validate([1, 1]), 'required + uniqueItems in allOf')
  t.end()
})
