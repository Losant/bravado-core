import _ from 'lodash';
import Entity from './entity.js';
import Collection from './collection.js';
import { issueToken, verifyToken } from './jwt-helpers.js';

const toBool = function(value) {
  return !!(value === true || value === 'true' || value === '1' || value === 'yes');
};

const buildEntity = function(context, entity) {
  const type = entity.type;
  const actions = {};
  const links = {};
  const baseAuth = [].concat(context.api.auth || [], context.api.resources[type].auth || []);
  for (const a in context.api.resources[type].actions) {
    const action = context.api.resources[type].actions[a];
    const actionAuth = baseAuth.concat(action.auth || []);
    if (actionAuth.length === 0 || context.checkAuthorization(actionAuth)) {
      actions[a] = action;
    }
  }
  for (const r in context.api.resources[type].links) {
    const link = context.api.resources[type].links[r];
    const linkAuth = baseAuth.concat(link.auth || []);
    if (linkAuth.length === 0 || context.checkAuthorization(linkAuth)) {
      links[r] = link;
    }
  }
  entity.actions = actions;
  entity.links = links;
};

export default function(event, context) {

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
  context.done = function(err, result) {
    if (this.committed) {
      throw new Error('Cannot call context.done after the context has already been committed');
    }
    result = result instanceof Entity ? result.toJSON(context.entityOptions) : result;
    try {
      this.committed = true;
      this._done(err, result);
    } catch (newErr) {
      this.committed = false;
      throw newErr;
    }
  }.bind(context);

  // overrides the context's succeed function with one that properly serializes entities
  context._succeed = context.succeed;
  context.succeed = function(result) {
    if (this.committed) {
      throw new Error('Cannot call context.succeed after the context has already been committed');
    }
    result = result instanceof Entity ? result.toJSON(context.entityOptions) : result;
    try {
      this.committed = true;
      this._succeed(result);
    } catch (newErr) {
      this.committed = false;
      throw newErr;
    }
  }.bind(context);

  // overrides the context's fail function to cancel further execution on failure
  context._fail = context.fail;
  context.fail = function(err) {
    if (this.committed) {
      throw new Error('Cannot call context.fail after the context has already been committed');
    }
    try {
      this.committed = true;
      this._fail(err);
    } catch (newErr) {
      this.committed = false;
      throw newErr;
    }
  }.bind(context);

  // convenience method to create an entity
  context.entity = function(type, obj) {
    const entity = new Entity({
      type: type,
      body: obj
    });
    buildEntity(context, entity);
    entity.links.self = { href: context.api.resources[type]['x-bravado-fullPath'] };
    return entity;
  };

  // convenience method to create a collection
  context.collection = function(type, itemType, obj) {
    const collection = new Collection({
      type: type,
      itemType: itemType,
      itemFactory: function(item) {
        return context.entity(itemType, item);
      },
      body: obj
    });
    buildEntity(context, collection);
    collection.links.self = { href: context.api.resources[type]['x-bravado-fullPath'] };
    return collection;
  };

  // convenience method to verify a JWT token
  context.verifyToken = verifyToken;

  // convenience method to issue a JWT token
  context.issueToken = (payload) => {
    return issueToken(payload);
  };

  // convenience method for checking the current user's authorization
  context.checkAuthorization = function(checkScope) {
    const scope = context.auth ? context.auth.scope || [] : [];
    const commonScope = _.intersection(checkScope, scope);
    return commonScope.length === 0 ? false : commonScope;
  };

}
