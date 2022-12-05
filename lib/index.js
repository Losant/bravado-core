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
    return function(event, context) {
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

      // execute the resource' _pre function if available
      if (!context.committed && controller._pre) {
        controller._pre(params, context)
          .then(function() {
            // execute the action controller implementation
            return controller[actionName](params, context);
          })
          .catch(function(err) {
            context.fail(err);
          });
      } else if (!context.committed) {
        // execute the action controller implementation
        return Promise.resolve()
          .then(() => {
            return controller[actionName](params, context);
          })
          .catch(function(err) {
            context.fail(err);
          });
      }
    };
  },

  ApiDefinition: require('./api-definition')

};
