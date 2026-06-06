import jsonRefs from 'json-refs';
import { dump, load } from 'js-yaml';
import fs from 'fs-extra';
import path from 'path';
import { pathToFileURL } from 'url';
import _ from 'lodash';
import dir from 'node-dir';
import util from 'util';

const getFilesInDir = util.promisify(dir.files);

// Resources are paired with a sibling `.js` HTTP handler module, so `.js` is
// intentionally excluded from RESOURCE_EXTS — the loader would shadow the handler.
const RESOURCE_EXTS = new Set(['.json', '.yaml', '.yml']);
// Definitions and examples are pure data, so `.js` modules are allowed there
// for programmatic schema composition; the module's default export is used as
// the parsed value.
const DATA_EXTS = new Set(['.json', '.yaml', '.yml', '.js']);

const loadDefinitionOrExample = async function(file, ext) {
  if (ext === '.js') {
    const mod = await import(pathToFileURL(file).href);
    if (!mod.default) {
      throw new Error(`Definition module ${file} has no default export`);
    }
    return mod.default;
  }
  return load(await fs.readFile(file));
};

const ApiDefinition = function(obj) {
  for (const r in obj.resources) {
    const resource = obj.resources[r];
    resource['x-bravado-fullPath'] = path.join('/', (obj.basePath || ''), resource.path);
    for (const a in resource.actions) {
      const action = resource.actions[a];
      action['x-bravado-fullPath'] = path.join('/', (obj.basePath || ''), resource.path, (action.path || ''));
    }
  }
  Object.assign(this, obj);
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
  value: function(file, options = {}) {
    options = { spaces: 2, encoding: 'utf8', ...options };
    const json = JSON.stringify(this, null, options.spaces);
    return fs.writeFile(file, json, options);
  }
});

Object.defineProperty(ApiDefinition.prototype, 'saveJsonSync', {
  enumerable: false,
  value: function(file, options = {}) {
    options = { spaces: 2, encoding: 'utf8', ...options };
    const json = JSON.stringify(this, null, options.spaces);
    return fs.writeFileSync(file, json, options);
  }
});

Object.defineProperty(ApiDefinition.prototype, 'saveYaml', {
  enumerable: false,
  value: function(file, options = {}) {
    options = { encoding: 'utf8', ...options };
    return fs.writeFile(file, dump(this, options), options);
  }
});

Object.defineProperty(ApiDefinition.prototype, 'saveYamlSync', {
  enumerable: false,
  value: function(file, options = {}) {
    options = { encoding: 'utf8', ...options };
    return fs.writeFileSync(file, dump(this, options), options);
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
  const doc = load(data);
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
  const doc = load(data);
  doc.resources = doc.resources || {};
  doc.definitions = doc.definitions || {};
  doc.examples = doc.examples || {};
  if (doc.authGroups) {
    Object.keys(doc.authGroups).forEach(function(group) {
      doc.authGroups[group] = _.flattenDeep(doc.authGroups[group]);
    });
  }
  const resourceFiles = await getFilesInDir(resourceDir);

  const resources = await Promise.all(resourceFiles.map(async function(file) {
    const ext = path.extname(file);
    if (RESOURCE_EXTS.has(ext)) {
      const base = path.basename(file, ext);
      return [ _.camelCase(base), await fs.readFile(file) ];
    }
    return null;
  }));
  resources.forEach(function(item) {
    if (!item) { return; }
    doc.resources[item[0]] = load(item[1]);
  });

  const definitionsFiles = await getFilesInDir(definitionDir);
  const defs = await Promise.all(definitionsFiles.map(async function(file) {
    const ext = path.extname(file);
    if (DATA_EXTS.has(ext)) {
      const base = path.basename(file, ext);
      const rel = path.relative(definitionDir, file);
      // Skip top-level paths starting with `_` — convention for
      // loader-invisible helper modules (e.g. losant-models's `_shared/`).
      if (rel[0] === '_') { return null; }
      const jpath = path.dirname(rel).split(path.sep);
      jpath.push(_.camelCase(base));
      return [ jpath, await loadDefinitionOrExample(file, ext) ];
    } else {
      return null;
    }
  }));
  defs.forEach(function(item) {
    if (!item) { return; }
    let obj = doc.definitions;
    item[0].forEach(function(part, i) {
      // Skip the `.` segment that path.dirname yields for top-level files,
      // and any `_*`/`.`-prefixed nested segment (helper-convention).
      if (part[0] === '_' || part[0] === '.') { return; }
      if (i < item[0].length - 1) {
        if (!obj[part]) {
          obj[part] = {};
        }
        obj = obj[part];
      } else {
        obj[part] = item[1];
      }
    });
  });
  const exampleFiles = await getFilesInDir(exampleDir);
  const examples = await Promise.all(exampleFiles.map(async function(file) {
    const ext = path.extname(file);
    if (DATA_EXTS.has(ext)) {
      const base = path.basename(file, ext);
      const rel = path.relative(exampleDir, file);
      // Skip top-level paths starting with `_` — convention for
      // loader-invisible helper modules
      if (rel[0] === '_') { return null; }
      const jpath = path.dirname(rel).split(path.sep);
      jpath.push(_.camelCase(base));
      return [ jpath, await loadDefinitionOrExample(file, ext) ];
    } else {
      return null;
    }
  }));
  examples.forEach(function(item) {
    if (!item) { return; }
    let obj = doc.examples;
    item[0].forEach(function(part, i) {
      // Skip the `.` segment that path.dirname yields for top-level files,
      // and any `_*`/`.`-prefixed nested segment (helper-convention).
      if (part[0] === '_' || part[0] === '.') { return; }
      if (i < item[0].length - 1) {
        if (!obj[part]) {
          obj[part] = {};
        }
        obj = obj[part];
      } else {
        obj[part] = item[1];
      }
    });
  });
  doc['x-bravado-sourceFile'] = index;
  const api = new ApiDefinition(doc);
  return api;
};

export default ApiDefinition;
