var intersect = require('intersect');
var errors = require('./errors');

module.exports = function (params, context) {
  if (!context.action.auth) { return; }
  var commonScope = intersect(context.action.auth, context.auth.scopes);
  context.auth.grantedScope = commonScope;
  if (commonScope.length === 0) {
    return context.fail(errors.Forbidden());
  }
};
