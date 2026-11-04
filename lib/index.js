import extendContext from './extend-context.js';
import prepareParams from './prepare-params.js';
import validateParams from './validate-params.js';
import authenticate from './authenticate.js';
import authorize from './authorize.js';

export { default as ApiDefinition } from './api-definition.js';

export default function(api, resourceName, actionName, controller) {
  const resource = api.resources[resourceName];
  const action = resource.actions[actionName];

  // execute the resource's initialize function
  if (controller._init || controller._initialize) {
    (controller._init || controller._initialize)();
  }

  // return the event handler
  return async function(event, context) {
    // add the current api, resource and action to the context for use down stream
    context.api = api;
    context.resource = resource;
    context.action = action;

    // add convenience methods to context
    extendContext(event, context);

    // extract params from the current event
    const params = prepareParams(event, context);

    // validate params
    validateParams(params, context);
    if (context.committed) { return; }

    // authenticate the event using the accessToken parameter
    authenticate(params, context);
    if (context.committed) { return; }

    // authorize the event using the scope from the token and scope required for action
    authorize(params, context);
    if (context.committed) { return; }

    try {
      if (controller._pre) {
        await controller._pre(params, context);
        if (context.committed) { return; }
      }

      await controller[actionName](params, context);
    } catch (e) {
      if (!context.committed) {
        context.fail(e);
      }
    }
  };
}
