const jsonRefs = require('json-refs');
const yaml = require('js-yaml');
const fs = require('fs-extra');
const path = require('path');
const defaults = require('defaults');
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
    return fs.writeFile(file, json, options);
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
    return fs.writeFile(file, yaml.safeDump(this, options), options);
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

ApiDefinition.load = async function(file) {
  const source = path.resolve(file);
  const data = await fs.readFile(file);
  const doc = yaml.safeLoad(data);
  doc['x-bravado-sourceFile'] = source;
  const api = new ApiDefinition(doc);
  return api;
};

ApiDefinition.build = async function(root, { resourceDir, definitionDir, exampleDir } = {}) {
  const index = path.resolve(root, 'api.yaml');
  resourceDir = resourceDir || path.resolve(root, 'resources');
  definitionDir = definitionDir || path.resolve(root, 'definitions');
  exampleDir = exampleDir || path.resolve(root, 'examples');
  const data = await fs.readFile(index);
  const doc = yaml.safeLoad(data);
  doc.resources = doc.resources || {};
  doc.definitions = doc.definitions || {};
  doc.examples = doc.examples || {};
  if (doc.authGroups) {
    Object.keys(doc.authGroups).forEach(function(group) {
      doc.authGroups[group] = _.flattenDeep(doc.authGroups[group]);
    });
  }
  const resourceFiles = await dir.files(resourceDir);

  const resources = await Promise.all(resourceFiles.map(async function(file) {
    const ext = path.extname(file);
    if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
      const base = path.basename(file, ext);
      return [ _.camelCase(base), await fs.readFile(file) ];
    }
    return null;
  }));
  resources.forEach(function(item) {
    if (!item) { return; }
    doc.resources[item[0]] = yaml.safeLoad(item[1]);
  });

  const definitionsFiles = await dir.files(definitionDir);
  const defs = await Promise.all(definitionsFiles.map(async function(file) {
    const ext = path.extname(file);
    if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
      const base = path.basename(file, ext);
      const rel = path.relative(definitionDir, file);
      if (rel[0] === '_') { return null; }
      const jpath = path.dirname(rel).split(path.sep);
      jpath.push(_.camelCase(base));
      return [ jpath, await fs.readFile(file) ];
    } else {
      return null;
    }
  }));
  let defObj;
  defs.forEach(function(item) {
    if (!item) { return; }
    let obj = defObj.definitions;
    item[0].forEach(function(part, i) {
      if (part[0] === '_' || part[0] === '.') { return false; }
      if (i < item[0].length - 1) {
        if (!obj[part]) {
          obj[part] = {};
        }
        obj = obj[part];
      } else {
        obj[part] = yaml.safeLoad(item[1]);
      }
    });
  });
  const exampleFiles = await dir.files(exampleDir);
  const examples = await Promise.all(exampleFiles.map(async function(file) {
    const ext = path.extname(file);
    if (ext === '.json' || ext === '.yaml' || ext === '.yml') {
      const base = path.basename(file, ext);
      const rel = path.relative(exampleDir, file);
      if (rel[0] === '_') { return null; }
      const jpath = path.dirname(rel).split(path.sep);
      jpath.push(_.camelCase(base));
      return [ jpath, await fs.readFile(file) ];
    } else { return null; }
  }));
  examples.forEach(function(item) {
    if (!item) { return; }
    let obj = doc.examples;
    item[0].forEach(function(part, i) {
      if (part[0] === '_' || part[0] === '.') { return false; }
      if (i < item[0].length - 1) {
        if (!obj[part]) {
          obj[part] = {};
        }
        obj = obj[part];
      } else {
        obj[part] = yaml.safeLoad(item[1]);
      }
    });
  });
  doc['x-bravado-sourceFile'] = index;
  const api = new ApiDefinition(doc);
  return api;
};

module.exports = ApiDefinition;
