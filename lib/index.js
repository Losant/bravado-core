var extendContext = require('./extend-context');
var prepareParams = require('./prepare-params');
var authenticate = require('./authenticate');
var authorize = require('./authorize');

module.exports = {

  handler: function (api, resourceName, actionName, impl) {
    var resource = api.resources[resourceName];
    var action = resource.actions[actionName];

    // execute the resource's initialize function
    if (impl._init || impl._initialize) {
      (impl._init || impl.initialize)();
    }

    // return the event handler
    return function (event, context) {
      // add the current api, resource and action to the context for use down stream
      context.api = api;
      context.resource = resource;
      context.action = action;

      // extract and validate params from the current event
      var params = prepareParams(event, action);

      // add convenience methods to context
      extendContext(params, context);
      // authenticate the event using the accessToken parameter
      if (!context.commited) { authenticate(params, context); }
      // authorize the event using the scope from the token and scope required for action
      if (!context.commited) { authorize(params, context); }

      // execute the resource' _pre function if available
      if (!context.commited && impl._pre) {
        impl._pre(params, context)
          .then(function () {
            // execute the action implementation
            impl[actionName](params, context);
          })
          .catch(function (err) {
            context.fail(err);
          });
      } else if (!context.commited){
        // execute the action implementation
        impl[actionName](params, context);
      }
    }
  },

  ApiDefinition: require('./api-definition')

};
