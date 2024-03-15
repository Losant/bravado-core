import uriTemplate from 'uri-template';

const buildEntityActions = function(actions, body) {
  const entityActions = {};
  for (const a in actions) {
    const action = actions[a];
    if (action.private) { continue; } // eslint-disable-line no-continue
    entityActions[a] = {};
    const actionTemplate = uriTemplate.parse(action['x-bravado-fullPath']);
    entityActions[a].href = actionTemplate.expand(body);
    if (action.deprecated) { entityActions[a].deprecated = true; }
    // if (action.description) { entityActions[a].description = action.description; }
    if (action.method) { entityActions[a].method = action.method; }
    if (action.params) {
      const params = [];
      for (const param in action.params) {
        if (!param.private && param.in !== 'path') {
          params.push(param);
        }
      }
      if (params.length > 0) {
        entityActions[a].params = params;
      }
    }
    // if (action.responses) { obj._actions[a].responses = action.responses; }
  }
  return entityActions;
};

// Object that represents an entity returned by a resource's action
const Entity = function(options) {
  options = options || {};
  this.type = options.type;
  this.body = options.body;
  this.actions = options.actions;
  this.links = options.links;
  this.embedded = options.embedded;
};

// Add a link to the the entity
Entity.prototype.link = function(rel, link) {
  this.links = this.links || {};
  link = 'string' === typeof link ? { href: link } : link;
  if (this.links[rel]) {
    if (!Array.isArray(this.links[rel])) {
      this.links[rel] = [this.links[rel]];
    }
    this.links[rel].push(link);
  } else {
    this.links[rel] = link;
  }
};

// Embed another entity
Entity.prototype.embed = function(rel, entity) {
  if (entity && !(entity instanceof Entity)) {
    entity = new Entity(entity);
  }
  this.embedded = this.embedded || {};
  if (this.embedded[rel]) {
    if (!Array.isArray(this.embedded[rel])) {
      this.embedded[rel] = [this.embedded[rel]];
    }
    this.embedded[rel].push(entity);
  } else {
    this.embedded[rel] = entity;
  }
};

Entity.prototype.toJSON = function(options) {
  if (typeof(options) === 'object') {
    // when an object, it is being called directly with options
    // so do proper defaulting
    options = {
      actions: true,
      links: true,
      embedded: true,
      ...options
    };
  } else {
    // when it is not an object, its being called as part of JSON.stringify
    // so to match previous behavior, all options are set to false
    options = {};
  }
  const obj = { ...this.body, _type: this.type };
  if (options.actions && this.actions) {
    obj._actions = buildEntityActions(this.actions, this.body);
  }
  if (options.links && this.links) {
    obj._links = {};
    for (const r in this.links) {
      const link = this.links[r];
      const linkTemplate = uriTemplate.parse(link.href);
      obj._links[r] = { href: linkTemplate.expand(this.body) };
      if (link.rel) { obj._links[r].rel = link.rel; }
      if (link.title) { obj._links[r].title = link.title; }
      if (link.deprecated) { obj._links[r].deprecated = true; }
    }
  }
  if (options.embedded && this.embedded) {
    obj._embedded = {};
    for (const r in this.embedded) {
      obj._embedded[r] = this.embedded[r].toJSON(options);
    }
  }
  return obj;
};

export default Entity;
