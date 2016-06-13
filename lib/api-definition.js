var jsonRefs = require('json-refs');
var yaml = require('js-yaml');
var fs = require('fs');
var path = require('path');
var uriTemplate = require('uri-template');
var defaults = require('defaults');
var q = require('q');
var assign = require('object-assign');
var validator = require('is-my-json-valid');
var traverse = require('traverse');
var camelCase = require('lodash.camelcase');
var dir = require('node-dir');
var errors = require('./errors');

var schemas = {
  '1.0': require('./schemas/bravado-1.0')
};

// TODO Enable schema definition validation

function ApiDefinition (obj) {
  var schema = schemas[obj.bravado] || schemas['1.0'];
  for (var r in obj.resources) {
    var resource = obj.resources[r];
    resource['x-bravado-fullPath'] = path.join('/', (obj.basePath || ''), resource.path);
    for (var a in resource.actions) {
      var action = resource.actions[a];
      action['x-bravado-fullPath'] = path.join('/', (obj.basePath || ''), resource.path, (action.path || ''));
    }
  }
  // var filter = validator.filter(schema)
  // Object.defineProperty(this, '_validate', {
  //   enumerable: false,
  //   value: validator(schema)
  // });
  // obj = filter(obj);
  assign(this, obj);
}

Object.defineProperty(ApiDefinition.prototype, 'resolveRefs', {
  enumerable: false,
  value: function () {
    var refsOptions = {
      relativeBase: this['x-bravado-sourceFile'],
      filter: [ 'local', 'relative', 'remote' ]
    };
    return jsonRefs.resolveRefs(this, refsOptions)
      .then(function (results) {
        return results.resolved;
      });
  }
});

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
      doc['x-bravado-sourceFile'] = source;
      var api = new ApiDefinition(doc);
      return api;
    });
};

ApiDefinition.build = function (root, options) {
  var sourceDir = path.resolve(root);
  var index = path.resolve(root, 'api.yaml');
  var resourceDir = path.resolve(root, 'resources');
  var defDir = path.resolve(root, 'definitions');
  var exampleDir = path.resolve(root, 'examples');
  return q.nfcall(fs.readFile, index)
    .then(function loadApi(data) {
      var doc = yaml.safeLoad(data);
      doc.resources = doc.resources || {};
      doc.definitions = doc.definitions || {};
      doc.examples = doc.examples || {};
      return [doc, q.nfcall(dir.files, resourceDir)];
    })
    .spread(function readResources(doc, files) {
      return q.all(files.map(function (file) {
        var ext = path.extname(file);
        if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
          var base = path.basename(file, ext);
          return q.all([doc, camelCase(base), q.nfcall(fs.readFile, file)]);
        } else { return null; }
      }));
    })
    .then(function parseResources(resources) {
      var doc;
      resources.forEach(function (item) {
        if (!item) { return; }
        if (!doc) { doc = item[0]; }
        doc.resources[item[1]] = yaml.safeLoad(item[2]);
      });
      return q.all([doc, q.nfcall(dir.files, defDir)]);
    })
    .spread(function readDefs(doc, files) {
      return q.all(files.map(function (file) {
        var ext = path.extname(file);
        if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
          var base = path.basename(file, ext);
          var rel = path.relative(defDir, file);
          if (rel[0] === '_') { return null; }
          var jpath = path.dirname(rel).split(path.sep);
          jpath.push(camelCase(base));
          return q.all([doc, jpath, q.nfcall(fs.readFile, file)]);
        } else { return null; }
      }));
    })
    .then(function parseDefs(defs) {
      var doc;
      defs.forEach(function (item) {
        if (!item) { return; }
        if (!doc) { doc = item[0]; }
        var obj = doc.definitions;
        item[1].forEach(function (part, i) {
          if (part[0] === '_' || part[0] === '.') { return false; }
          if (i < item[1].length - 1) {
            if (!obj[part]) {
              obj[part] = {};
            }
            obj = obj[part];
          } else {
            obj[part] = yaml.safeLoad(item[2]);
          }
        });
      });
      return q.all([doc, q.nfcall(dir.files, exampleDir)]);
    })
    .spread(function readExamples(doc, files) {
      return q.all(files.map(function (file) {
        var ext = path.extname(file);
        if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
          var base = path.basename(file, ext);
          var rel = path.relative(defDir, file);
          if (rel[0] === '_') { return null; }
          var jpath = path.dirname(rel).split(path.sep);
          jpath.push(camelCase(base));
          return q.all([doc, jpath, q.nfcall(fs.readFile, file)]);
        } else { return null; }
      }));
    })
    .then(function parseExamples(examples) {
      var doc;
      examples.forEach(function (item) {
        if (!item) { return; }
        if (!doc) { doc = item[0]; }
        var obj = doc.examples;
        item[1].forEach(function (part, i) {
          if (part[0] === '_' || part[0] === '.') { return false; }
          if (i < item[1].length - 1) {
            if (!obj[part]) {
              obj[part] = {};
            }
            obj = obj[part];
          } else {
            obj[part] = yaml.safeLoad(item[2]);
          }
        });
      });
      return doc;
    })
    .then(function (doc) {
      doc['x-bravado-sourceFile'] = index;
      var api = new ApiDefinition(doc);
      return api;
    });
};

module.exports = ApiDefinition;
