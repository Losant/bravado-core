var jsonRefs = require('json-refs');
var yaml = require('js-yaml');
var fs = require('fs');
var path = require('path');
var uriTemplate = require('uri-template');
var defaults = require('defaults');
var q = require('q');
var assign = require('object-assign');
var validator = require('is-my-json-valid');
var errors = require('./errors');

var schemas = {
  '1.0': require('./schemas/bravado-1.0')
};

function ApiDefinition (obj, file) {
  var schema = schemas[obj.bravado] || schemas['1.0'];
  // var filter = validator.filter(schema)
  Object.defineProperty(this, '_source', {
    enumerable: false,
    value: file
  });
  // Object.defineProperty(this, '_validate', {
  //   enumerable: false,
  //   value: validator(schema)
  // });
  // obj = filter(obj);
  assign(this, obj);
}

Object.defineProperty(ApiDefinition.prototype, 'saveJson', {
  enumerable: false,
  value: function (file, options) {
    options = defaults(options, { spaces: 2, encoding: 'utf8' });
    var json = JSON.stringify(this, null, options.spaces);
    return q.nfcall(fs.writeFile, file, json, options);
  }
});

Object.defineProperty(ApiDefinition.prototype, 'saveJsonSync', {
  enumerable: false,
  value: function (file, options) {
    options = defaults(options, { spaces: 2, encoding: 'utf8' });
    var json = JSON.stringify(this, null, options.spaces);
    return fs.writeFileSync(file, json, options);
  }
});

Object.defineProperty(ApiDefinition.prototype, 'saveYaml', {
  enumerable: false,
  value: function (file, options) {
    options = defaults(options, { encoding: 'utf8' });
    var yaml = yaml.safeDump(this, options);
    return q.nfcall(fs.writeFile,file, yaml, options);
  }
});

Object.defineProperty(ApiDefinition.prototype, 'saveYamlSync', {
  enumerable: false,
  value: function (file, options) {
    options = defaults(options, { encoding: 'utf8' });
    var yaml = yaml.safeDump(this, options);
    return fs.writeFileSync(file, yaml, options);
  }
});

Object.defineProperty(ApiDefinition.prototype, 'validate', {
  enumerable: false,
  value: function () {
    // if (!this._validate(this)){
    //   var error = this._validate.errors[0];
    //   throw new errors.Validation({
    //     field: error.field,
    //     validationMessage: error.message
    //   });
    // }
  }
});

ApiDefinition.load = function (file, options) {
  var source = path.resolve(file);
  return q.nfcall(fs.readFile, file)
    .then(function (data) {
      var doc = yaml.safeLoad(data);
      var refsOptions = {
        location: path.dirname(source),
        processContent: function (content, ref) {
          content = yaml.safeLoad(content);
          return content;
        }
      };
      return jsonRefs.resolveRefs(doc, refsOptions);
    })
    .then(function (results) {
      var api = results.resolved;
      for (var r in api.resources) {
        var resource = api.resources[r];
        resource['x-bravado-fullPath'] = path.join('/', (api.basePath || ''), resource.path);
        for (var a in resource.actions) {
          var action = resource.actions[a];
          action['x-bravado-fullPath'] = path.join('/', (api.basePath || ''), resource.path, (action.path || ''));
        }
      }
      var def = new ApiDefinition(api, source);
      return def;
    });
};

function uriTemplateToRegex (path) {
  var valReg = '((?:[\\w.~-]|(?:%[0-9A-F]{2}))+)';
  var matchableExps = ['SimpleExpression', 'NamedExpression',
    'ReservedExpression', 'LabelExpression', 'PathSegmentExpression',
    'PathParamExpression'];
  var escape = function (str) {
    str = str || '';
    return str.replace(/[.*+?|()\[\]{}\\]/g, '\'$&') ;
  };
  var template = uriTemplate.parse(path);
  var regex = escape(template.prefix);
  template.expressions.forEach(function (exp, i) {
    var delim = '';
    regex += escape(exp.prefix);
    if (matchableExps.indexOf(exp.constructor.name) >= 0) {
      regex += escape(exp.first);
      exp.params.forEach(function () {
        regex += delim + valReg;
        delim = escape(exp.sep);
      });
      regex += escape(exp.last);
    }
    regex += escape(exp.suffix);
  }.bind(this));
  regex += escape(template.suffix);
  return new RegExp('^' + regex + '$', 'i');
}

module.exports = ApiDefinition;
