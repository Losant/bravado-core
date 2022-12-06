const extendContext = require('./extend-context');
const prepareParams = require('./prepare-params');
const validateParams = require('./validate-params');
const authenticate = require('./authenticate');
const authorize = require('./authorize');

module.exports = {

  handler: function(api, resourceName, actionName, controller) {
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

      // authenticate the event using the accessToken parameter
      if (!context.committed) { authenticate(params, context); }

      // authorize the event using the scope from the token and scope required for action
      if (!context.committed) { authorize(params, context); }

      if (!context.committed) {
        if (controller._pre) {
          try {
            // execute the resource' _pre function if available
            await controller._pre(params, context);
          } catch (err) {
            context.fail(err);
          }
        }
        try {
          // execute the action controller implementation
          return await controller[actionName](params, context);
        } catch (err) {
          context.fail(err);
        }
      }
    };
  },

  ApiDefinition: require('./api-definition')

};
