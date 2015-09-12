module.exports = function (event, action) {
  // TODO validate parameters
  var params = {};
  if (event.type === 'http-request') {
    var token;
    if (event.request.querystring.access_token || event.request.querystring.jwt) {
      token = event.request.querystring.access_token || event.request.querystring.jwt;
    } else {
      for (var header in event.request.headers) {
        if (header.toLowerCase() === 'authorization') {
          var auth = event.request.headers.authorization.split(' ');
          if (auth[0].toUpperCase() === 'BEARER' || auth[0].toUpperCase() === 'JWT') {
            token = auth[1];
            break;
          }
        }
      }
    }
    params.accessToken = token;
  }
  if (Array.isArray(action.params)) {
    action.params.forEach(function (param) {
      switch (param.in) {
        case 'body':
          params[param.name] = event.request.body;
          break;
        case 'query':
        params[param.name] = event.request.querystring[param.name];
          break;
        case 'path':
          params[param.name] = event.request.path[param.name];
          break;
        case 'header':
          params[param.name] = event.request.headers[param.name];
          break;
      }
    });
  }
  return params;
};
