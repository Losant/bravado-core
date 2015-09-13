var errors = require('./errors');

module.exports = function (params, context) {
  if (!context.action.auth) { return; }
  var commonScope = context.checkAuthorization(context.action.auth);
  if (commonScope) {
    context.auth = context.auth || {};
    context.auth.grantedScope = commonScope;
  } else {
    context.fail(errors.Forbidden());
  }
};
