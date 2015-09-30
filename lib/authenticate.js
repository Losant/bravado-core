var jwt = require('jsonwebtoken');
var intersect = require('intersect');
var errors = require('./errors');

module.exports = function (params, context) {
  if (!params.accessToken) { return; }
  try {
    var decodedToken = context.verifyToken(params.accessToken);
    context.auth = decodedToken;
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return context.fail(errors.Unauthorized({ message: 'Access token has expired' }));
    } else if (err.name === 'JsonWebTokenError') {
      return context.fail(errors.Unauthorized({ message: 'Invalid access token' }));
    }
  }
};