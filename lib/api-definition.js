const jsonRefs = require('json-refs');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const defaults = require('defaults');
const q = require('q');
const assign = require('object-assign');
const _ = require('lodash');
const dir = require('node-dir');

const ApiDefinition = function(obj) {
  for (const r in obj.resources) {
    const resource = obj.resources[r];
    resource['x-bravado-fullPath'] = path.join('/', (obj.basePath || ''), resource.path);
    for (const a in resource.actions) {
      const action = resource.actions[a];
      action['x-bravado-fullPath'] = path.join('/', (obj.basePath || ''), resource.path, (action.path || ''));
    }
  }
  assign(this, obj);
};

Object.defineProperty(ApiDefinition.prototype, 'resolveRefs', {
  enumerable: false,
  value: function() {
    const refsOptions = {
      relativeBase: this['x-bravado-sourceFile'],
      filter: [ 'local', 'relative', 'remote' ]
    };
    return jsonRefs.resolveRefs(this, refsOptions)
      .then(function(results) {
        return results.resolved;
      });
  }
});

Object.defineProperty(ApiDefinition.prototype, 'saveJson', {
  enumerable: false,
  value: function(file, options) {
    options = defaults(options, { spaces: 2, encoding: 'utf8' });
    const json = JSON.stringify(this, null, options.spaces);
    return q.nfcall(fs.writeFile, file, json, options);
  }
});

Object.defineProperty(ApiDefinition.prototype, 'saveJsonSync', {
  enumerable: false,
  value: function(file, options) {
    options = defaults(options, { spaces: 2, encoding: 'utf8' });
    const json = JSON.stringify(this, null, options.spaces);
    return fs.writeFileSync(file, json, options);
  }
});

Object.defineProperty(ApiDefinition.prototype, 'saveYaml', {
  enumerable: false,
  value: function(file, options) {
    options = defaults(options, { encoding: 'utf8' });
    return q.nfcall(fs.writeFile, file, yaml.safeDump(this, options), options);
  }
});

Object.defineProperty(ApiDefinition.prototype, 'saveYamlSync', {
  enumerable: false,
  value: function(file, options) {
    options = defaults(options, { encoding: 'utf8' });
    return fs.writeFileSync(file, yaml.safeDump(this, options), options);
  }
});

Object.defineProperty(ApiDefinition.prototype, 'validate', {
  enumerable: false,
  value: function() {
    // if (!this._validate(this)){
    //   var error = this._validate.errors[0];
    //   throw new errors.Validation({
    //     field: error.field,
    //     validationMessage: error.message
    //   });
    // }
  }
});

ApiDefinition.load = function(file) {
  const source = path.resolve(file);
  return q.nfcall(fs.readFile, file)
    .then(function(data) {
      const doc = yaml.safeLoad(data);
      doc['x-bravado-sourceFile'] = source;
      const api = new ApiDefinition(doc);
      return api;
    });
};

ApiDefinition.build = function(root, { resourceDir, definitionDir, exampleDir } = {}) {
  const index = path.resolve(root, 'api.yaml');
  resourceDir = resourceDir || path.resolve(root, 'resources');
  definitionDir = definitionDir || path.resolve(root, 'definitions');
  exampleDir = exampleDir || path.resolve(root, 'examples');
  return q.nfcall(fs.readFile, index)
    .then(function loadApi(data) {
      const doc = yaml.safeLoad(data);
      doc.resources = doc.resources || {};
      doc.definitions = doc.definitions || {};
      doc.examples = doc.examples || {};
      if (doc.authGroups) {
        Object.keys(doc.authGroups).forEach(function(group) {
          doc.authGroups[group] = _.flattenDeep(doc.authGroups[group]);
        });
      }
      return [doc, q.nfcall(dir.files, resourceDir)];
    })
    .spread(function readResources(doc, files) {
      return q.all(files.map(function(file) {
        const ext = path.extname(file);
        if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
          const base = path.basename(file, ext);
          return q.all([doc, _.camelCase(base), q.nfcall(fs.readFile, file)]);
        } else { return null; }
      }));
    })
    .then(function parseResources(resources) {
      let doc;
      resources.forEach(function(item) {
        if (!item) { return; }
        if (!doc) { doc = item[0]; }
        doc.resources[item[1]] = yaml.safeLoad(item[2]);
      });
      return q.all([doc, q.nfcall(dir.files, definitionDir)]);
    })
    .spread(function readDefs(doc, files) {
      return q.all(files.map(function(file) {
        const ext = path.extname(file);
        if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
          const base = path.basename(file, ext);
          const rel = path.relative(definitionDir, file);
          if (rel[0] === '_') { return null; }
          const jpath = path.dirname(rel).split(path.sep);
          jpath.push(_.camelCase(base));
          return q.all([doc, jpath, q.nfcall(fs.readFile, file)]);
        } else { return null; }
      }));
    })
    .then(function parseDefs(defs) {
      let doc;
      defs.forEach(function(item) {
        if (!item) { return; }
        if (!doc) { doc = item[0]; }
        let obj = doc.definitions;
        item[1].forEach(function(part, i) {
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
      return q.all(files.map(function(file) {
        const ext = path.extname(file);
        if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
          const base = path.basename(file, ext);
          const rel = path.relative(exampleDir, file);
          if (rel[0] === '_') { return null; }
          const jpath = path.dirname(rel).split(path.sep);
          jpath.push(_.camelCase(base));
          return q.all([doc, jpath, q.nfcall(fs.readFile, file)]);
        } else { return null; }
      }));
    })
    .then(function parseExamples(examples) {
      let doc;
      examples.forEach(function(item) {
        if (!item) { return; }
        if (!doc) { doc = item[0]; }
        let obj = doc.examples;
        item[1].forEach(function(part, i) {
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
    .then(function(doc) {
      doc['x-bravado-sourceFile'] = index;
      const api = new ApiDefinition(doc);
      return api;
    });
};

module.exports = ApiDefinition;
