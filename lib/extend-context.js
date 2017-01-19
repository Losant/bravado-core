var jwt = require('jsonwebtoken');
var assign = require('object-assign');
var defaults = require('defaults');
var _ = require('lodash');
var Entity = require('./entity');
var Collection = require('./collection');

function toBool (value) {
  return value === true || value === 'true' || value === '1' || value === 'yes' ?
    true : false;
}

function buildEntity (context, entity) {
  var type = entity.type;
  var actions = {};
  var links = {};
  var baseAuth = [].concat(context.api.auth || [], context.api.resources[type].auth || [])
  for (var a in context.api.resources[type].actions) {
    var action = context.api.resources[type].actions[a];
    var actionAuth = baseAuth.concat(action.auth || []);
    if (actionAuth.length === 0 || context.checkAuthorization(actionAuth)) {
      actions[a] = action;
    }
  }
  for (var r in context.api.resources[type].links) {
    var link = context.api.resources[type].links[r];
    var linkAuth = baseAuth.concat(link.auth || []);
    if (linkAuth.length === 0 || context.checkAuthorization(linkAuth)) {
      links[r] = link;
    }
  }
  entity.actions = actions;
  entity.links = links;
}

module.exports = function (event, context) {

  // check for entity options on the request
  if (event.httpRequest) {
    context.entityOptions = {
      actions: event.request.querystring._actions ? toBool(event.request.querystring._actions) : true,
      links: event.request.querystring._links ? toBool(event.request.querystring._links) : true,
      embedded: event.request.querystring._embedded ? toBool(event.request.querystring._embedded) : true
    };
  } else {
    context.entityOptions = {
      actions: event._actions ? toBool(event._actions) : true,
      links: event._links ? toBool(event._links) : true,
      embedded: event._embedded ? toBool(event._embedded) : true
    };
  }

  // overrides the context's done function with one that properly serializes entities
  context._done = context.done;
  context.done = function (err, result) {
    if (this.committed) {
      throw new Error('Cannot call context.done after the context has already been committed');
    }
    this.committed = true;
    if (err) { return this._done(err); }
    result = result instanceof Entity ? result.toJSON(context.entityOptions) : result;
    this._done(null, result);
  }.bind(context);

  // overrides the context's succeed function with one that properly serializes entities
  context._succeed = context.succeed;
  context.succeed = function (result) {
    if (this.committed) {
      throw new Error('Cannot call context.succeed after the context has already been committed');
    }
    this.committed = true;
    result = result instanceof Entity ? result.toJSON(context.entityOptions) : result;
    this._succeed(result);
  }.bind(context);

  // overrides the context's fail function to cancel further execution on failure
  context._fail = context.fail;
  context.fail = function (err) {
    if (this.committed) {
      throw new Error('Cannot call context.fail after the context has already been committed');
    }
    this.committed = true;
    this._fail(err);
  }.bind(context);

  // convenience method to create an entity
  context.entity = function (type, obj) {
    var entity = new Entity({
      type: type,
      body: obj
    });
    buildEntity(context, entity);
    entity.links.self = { href: context.api.resources[type]['x-bravado-fullPath'] };
    return entity;
  };

  // convenience method to create a collection
  context.collection = function (type, itemType, obj) {
    var collection = new Collection({
      type: type,
      itemType: itemType,
      itemFactory: function (item) {
        return context.entity(itemType, item);
      },
      body: obj
    });
    buildEntity(context, collection);
    collection.links.self = { href: context.api.resources[type]['x-bravado-fullPath'] };
    return collection;
  };

  // convenience method to verify a JWT token
  context.verifyToken = function (token) {
    var options = defaults({
      algorithm: process.env.JWT_ALGO,
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE
    }, {
      algorithm: 'HS256',
      audience: ''
    });
    return jwt.verify(token, process.env.JWT_SECRET, options);
  };

  // convenience method to issue a JWT token
  context.issueToken = function (payload) {
    var options = defaults({
      algorithm: process.env.JWT_ALGO,
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE
    }, {
      algorithm: 'HS256',
      audience: ''
    });
    return jwt.sign(payload, process.env.JWT_SECRET, options);
  };

  // convenience method for checking the current user's authorization
  context.checkAuthorization = function (checkScope) {
    var scope = context.auth ? context.auth.scope || [] : [];
    var commonScope = _.intersection(checkScope, scope);
    return commonScope.length === 0 ? false : commonScope;
  };

};
