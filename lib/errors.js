var TypedError = require('error/typed');
var WrappedError = require('error/wrapped');

// http response code reference:
// 400 BAD REQUEST              401 UNAUTHORIZED                    402 PAYMENT REQUIRED
// 403 FORBIDDEN                404 NOT FOUND                       405 METHOD NOT ALLOWED
// 406 NOT ACCEPTABLE           407 PROXY AUTHENTICATION REQUIRED   408 REQUEST TIMEOUT
// 409 CONFLICT                 410 GONE                            411 LENGTH REQUIRED
// 412 PRECONDITION FAILED      413 REQUEST ENTITY TOO LARGE        414 REQUEST URI TOO LONG
// 415 UNSUPPORTED MEDIA TYPE   416 REQUEST RANGE NOT SATISFIABLE   417 EXPECTATION FAILED
//
// 500 INTERNAL SERVER ERROR    501 NOT IMPLEMENTED                 502 BAD GATEWAY
// 503 SERVICE UNAVAILABLE      504 GATEWAY TIMEOUT                 505 HTTP VERSION NOT SUPPORTED

module.exports = {

  Unauthorized: TypedError({
    type: 'Unauthorized',
    message: 'Unauthorized',
    statusCode: 401
  }),

  Forbidden: TypedError({
    type: 'Forbidden',
    message: 'Access is forbidden',
    statusCode: 403
  }),

  NotFound: TypedError({
    type: 'NotFound',
    message: '{title} was not found',
    title: null,
    statusCode: 404
  }),

  Validation: TypedError({
    type: 'Validation',
    message: '{field} {validationMessage}',
    field: null,
    validationMessage: null,
    statusCode: 400
  })

};
