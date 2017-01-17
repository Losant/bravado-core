var jwt = require('jsonwebtoken');
var _ = require('lodash');
var errors = require('./errors');

// Decodes the accessToken provided in the params and saves it in the current
// context.
module.exports = function (params, context) {
  if (!params.accessToken) { return; }
  try {
    var decodedToken = context.verifyToken(params.accessToken);
    context.auth = decodedToken;
    context.auth.scope = context.auth.scope || [];
    if(context.api.authGroups){
      context.auth.scope = Array.prototype.concat.apply(context.auth.scope,
        context.auth.scope.map(function(scope){
          return context.api.authGroups[scope] || [];
        })
      );
    }
    context.auth.scope = _.uniq(context.auth.scope);
    console.log(context.auth.scope)
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return context.fail(errors.Unauthorized({ message: 'Access token has expired' }));
    } else if (err.name === 'JsonWebTokenError') {
      return context.fail(errors.Unauthorized({ message: 'Invalid access token' }));
    }
  }
};
