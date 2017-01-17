var errors = require('./errors');

// Checks authorization of the authenticated user against required action scope
module.exports = function (params, context) {
  var actionAuth = [].concat(
    context.api.auth      || [],
    context.resource.auth || [],
    context.action.auth   || []
  );
  if (actionAuth.length === 0) { return; }
  var commonScope = context.checkAuthorization(actionAuth);
  if (commonScope) {
    context.auth = context.auth || {};
    context.auth.grantedScope = commonScope;
  } else {
    context.fail(errors.Forbidden());
  }
};
