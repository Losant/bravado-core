import _ from 'lodash';
import errors from './errors.js';

// Decodes the accessToken provided in the params and saves it in the current
// context.
export default function(params, context) {
  if (!params.accessToken) { return; }
  try {
    const decodedToken = context.verifyToken(params.accessToken);
    context.auth = decodedToken;
    context.auth.scope = context.auth.scope || [];
    if (context.api.authGroups) {
      context.auth.scope = Array.prototype.concat.apply(context.auth.scope,
        context.auth.scope.map(function(scope) {
          return context.api.authGroups[scope] || [];
        })
      );
    }
    context.auth.scope = _.uniq(context.auth.scope);
  } catch (err) {
    if (err.name === 'FAST_JWT_EXPIRED') {
      return context.fail(errors.Unauthorized({ message: 'Access token has expired' }));
    } else if (err.code?.startsWith('FAST_JWT')) {
      return context.fail(errors.Unauthorized({ message: 'Invalid access token' }));
    }
  }
}
