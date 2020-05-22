var util = require('util')
var jaystring = require('jaystring')

var INDENT_START = /[\{\[]/
var INDENT_END = /[\}\]]/

var genfun = function() {
  var lines = []
  var indent = 0
  var vars = {}

  var push = function(str) {
    lines.push(' '.repeat(indent * 2) + str)
  }

  var pushLine = function(line) {
    if (INDENT_END.test(line.trim()[0]) && INDENT_START.test(line[line.length - 1])) {
      indent--
      push(line)
      indent++
      return
    }
    if (INDENT_START.test(line[line.length - 1])) {
      push(line)
      indent++
      return
    }
    if (INDENT_END.test(line.trim()[0])) {
      indent--
      push(line)
      return
    }

    push(line)
  }

  var line = function(fmt) {
    if (!fmt) return line

    if (arguments.length === 1 && fmt.indexOf('\n') > -1) {
      var lines = fmt.trim().split('\n')
      for (var i = 0; i < lines.length; i++) {
        pushLine(lines[i].trim())
      }
    } else {
      pushLine(util.format.apply(util, arguments))
    }

    return line
  }

  line.toString = function() {
    return lines.join('\n')
  }

  line.toModule = function(scope) {
    if (!scope) scope = {}

    var scopeSource = Object.entries(scope)
      .map(function([key, value]) {
        return `var ${key} = ${jaystring(value)};`
      })
      .join('\n')

    return `(function() {\n${scopeSource}\nreturn (${line})})();`
  }

  line.toFunction = function(scope) {
    if (!scope) scope = {}

    var src = 'return (' + line.toString() + ')'

    var keys = Object.keys(scope).map(function(key) {
      return key
    })

    var vals = keys.map(function(key) {
      return scope[key]
    })

    return Function.apply(null, keys.concat(src)).apply(null, vals)
  }

  if (arguments.length) line.apply(null, arguments)

  return line
}

module.exports = genfun
