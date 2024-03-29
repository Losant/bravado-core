import errors from './errors.js';

// Checks authorization of the authenticated user against required action scope
export default function(params, context) {
  const actionAuth = [].concat(
    context.api.auth || [],
    context.resource.auth || [],
    context.action.auth || []
  );
  if (actionAuth.length === 0) { return; }
  const commonScope = context.checkAuthorization(actionAuth);
  if (commonScope) {
    context.auth = context.auth || {};
    context.auth.grantedScope = commonScope;
  } else {
    context.fail(errors.Forbidden());
  }
}
