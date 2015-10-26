var extendContext = require('./extend-context');
var prepareParams = require('./prepare-params');
var validateParams = require('./validate-params');
var authenticate = require('./authenticate');
var authorize = require('./authorize');

module.exports = {

  handler: function (api, resourceName, actionName, controller) {
    var resource = api.resources[resourceName];
    var action = resource.actions[actionName];

    // execute the resource's initialize function
    if (controller._init || controller._initialize) {
      (controller._init || controller._initialize)();
    }

    // return the event handler
    return function (event, context) {
      // add the current api, resource and action to the context for use down stream
      context.api = api;
      context.resource = resource;
      context.action = action;

      // add convenience methods to context
      extendContext(event, context);

      // extract params from the current event
      var params = prepareParams(event, context);

      // validate params
      validateParams(params, context);

      // authenticate the event using the accessToken parameter
      if (!context.committed) { authenticate(params, context); }

      // authorize the event using the scope from the token and scope required for action
      if (!context.committed) { authorize(params, context); }

      // execute the resource' _pre function if available
      if (!context.committed && controller._pre) {
        controller._pre(params, context)
          .then(function () {
            // execute the action controllerementation
            controller[actionName](params, context);
          })
          .catch(function (err) {
            context.fail(err);
          });
      } else if (!context.committed){
        // execute the action controllerementation
        controller[actionName](params, context);
      }
    };
  },

  ApiDefinition: require('./api-definition')

};
