var tape = require('tape')
var schema = require('./fixtures/schema.json')
var validator = require('../')

tape('nested', function(t) {
	var validate = validator(schema)

	t.ok(validate({x:{}}), 'should be valid')
	t.end()
})