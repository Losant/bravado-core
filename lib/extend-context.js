var jwt = require('jsonwebtoken');
var assign = require('object-assign');
var defaults = require('defaults');
var Entity = require('./entity');
var Collection = require('./collection');

function toBool (value) {
  return value === true || value === 'true' || value === '1' || value === 'yes' ?
    true : false;
}

module.exports = function (params, context) {

  // check for entity options on the request
  if (params.type === 'http-request') {
    context.entityOptions = {
      actions: params.request.querystring._actions ? toBool(params.request.querystring._actions) : true,
      links: params.request.querystring._links ? toBool(params.request.querystring._links) : true,
      embedded: params.request.querystring._embedded ? toBool(params.request.querystring._embedded) : true
    };
  } else {
    context.entityOptions = {
      actions: params._actions ? toBool(params._actions) : true,
      links: params._links ? toBool(params._links) : true,
      embedded: params._embedded ? toBool(params._embedded) : true
    };
  }

  // overrides the context's done function with one that properly serializes entities
  context._done = context.done;
  context.done = function (err, result) {
    if (err) { return this._done(err); }
    result = result instanceof Entity ? result.toJSON(context.entityOptions) : result;
    this._done(null, result);
  }.bind(context);

  // overrides the context's succeed function with one that properly serializes entities
  context._succeed = context.succeed;
  context.succeed = function (result) {
    result = result instanceof Entity ? result.toJSON(context.entityOptions) : result;
    this._succeed(result);
  }.bind(context);

  // overrides the context's fail function to cancel further execution on failure
  context._fail = context.fail;
  context.fail = function (result) {
    this.failed = true;
    this._fail(result);
  }.bind(context);

  // convenience method to create an entity
  context.entity = function (type, obj) {
    var entity = new Entity({
      type: type,
      body: obj,
      actions: context.api.resources[type].actions,
      links: context.api.resources[type].links || {}
    });
    entity.links.self = { href: entity.actions.get._fullPath };
    return entity;
  };

  // convenience method to create a collection
  context.collection = function (type, itemType, obj) {
    var collection = new Collection({
      type: type,
      itemType: itemType,
      body: obj,
      actions: context.api.resources[type].actions,
      links: context.api.resources[type].links ||  {}
    });
    collection.links.self = { href: collection.actions.get._fullPath };
    collection.createItemEntity = function (item) {
      return context.entity(this.itemType, item);
    }
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
  },

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

};
