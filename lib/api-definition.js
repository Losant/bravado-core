var jsonRefs = require('json-refs');
var yaml = require('js-yaml');
var fs = require('fs');
var path = require('path');
var uriTemplate = require('uri-template');
var defaults = require('defaults');
var q = require('q');
var assign = require('object-assign');

function ApiDefinition (obj) {
  assign(this, obj);
}

ApiDefinition.prototype.saveJson = function (file, options) {
  options = defaults(options, { spaces: 2, encoding: 'utf8' });
  var json = JSON.stringify(this, null, options.spaces);
  return q.nfcall(fs.writeFile, json, options);
};

ApiDefinition.prototype.saveYaml = function (file, options) {
  options = defaults(options, { encoding: 'utf8' });
  var yaml = yaml.safeDump(this, options);
  return q.nfcall(fs.writeFile, yaml, options);
};

ApiDefinition.prototype.validate = function () {
  // TODO implement schema validation
};

ApiDefinition.prototype.toSwagger = function (options) {
  // TODO implement swagger conversion
};

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
      api._source = source;
      for (var r in api.resources) {
        var resource = api.resources[r];
        for (var a in resource.actions) {
          var action = resource.actions[a];
          if (resource.params) {
            action.params = resource.params.concat(action.params || []);
          }
          action._id = [r, a, api.info.version].join('_');
          action._fullPath = path.join('/', (api.basePath || ''), resource.path, (action.path || ''));
          action._pathRegex = uriTemplateToRegex(action._fullPath);
          action['x-aws-lambda'] = defaults(action['x-aws-lambda'], {
            Description: action.description,
            FunctionName: action._id,
            Handler: 'handler',
            Runtime: 'nodejs',
            Timeout: 3
          });
        }
      }
      var def = new ApiDefinition(api);
      return def;
    })
    .catch(function (err) {
      console.log(err);
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
