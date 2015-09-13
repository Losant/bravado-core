var assign = require('object-assign');
var uriTemplate = require('uri-template');
var defaults = require('defaults');

function Entity (options) {
  options = options || {};
  this.type = options.type;
  this.body = options.body;
  this.actions = options.actions;
  this.links = options.links;
  this.embedded = options.embedded;
}

Entity.prototype.link = function (rel, link) {
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

Entity.prototype.embed = function (rel, entity) {
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

Entity.prototype.toJSON = function (options) {
  options = defaults(options, {
    actions: true,
    links: true,
    embedded: true
  });
  var obj = assign({}, this.body);
  if (options.actions && this.actions) {
    obj._actions = {};
    for (var a in this.actions) {
      var action = this.actions[a];
      obj._actions[a] = {};
      var actionTemplate = uriTemplate.parse(action['x-bravado-fullPath']);
      obj._actions[a].path = actionTemplate.expand(this.body);
      if (action.description) { obj._actions[a].description = action.description; }
      if (action.method) { obj._actions[a].method = action.method; }
      if (action.auth) { obj._actions[a].auth = action.auth; }
      if (action.params) {
        var params = [];
        action.params.forEach(function (param) {
          if (param.in !== 'path') {
            params.push(param);
          }
        });
        if (params.length > 0) {
          obj._actions[a].params = params;
        }
      }
      if (action.responses) { obj._actions[a].responses = action.responses; }
    }
  }
  if (options.links && this.links) {
    obj._links = {};
    for (var r in this.links) {
      var link = this.links[r];
      var linkTemplate = uriTemplate.parse(link.href);
      obj._links[r] = { href: linkTemplate.expand(this.body) };
      if (link.rel) { obj._links[r].rel = link.rel; }
      if (link.title) { obj._links[r].title = link.title; }
    }
  }
  if (options.embedded && this.embedded) {
    obj._embedded = {};
    for (var r in this.embedded) {
      obj._embedded[r] = this.embedded[r].toJSON(options);
    }
  }
  return obj;
};

module.exports = Entity;
