const extractHeaderToken = function(headers) {
  for (const header in headers) {
    if (header.toLowerCase() === 'authorization') {
      const auth = headers[header].split(' ');
      if (auth[0].toUpperCase() === 'BEARER' || auth[0].toUpperCase() === 'JWT') {
        return auth[1];
      }
    }
  }
};

module.exports = function(event, context) {
  let params = {};
  if (event.httpRequest) {
    let token;
    if (event.request.querystring.access_token || event.request.querystring.jwt) {
      token = event.request.querystring.access_token || event.request.querystring.jwt;
    } else {
      token = extractHeaderToken(event.request.headers);
    }
    params.accessToken = token;
    const definedParams = [].concat(
      Array.isArray(context.api.params) ? context.api.params : [],
      Array.isArray(context.resource.params) ? context.resource.params: [],
      Array.isArray(context.action.params) ? context.action.params: []
    );
    if (Array.isArray(definedParams)) {
      definedParams.forEach(function(param) {
        switch (param.in) {
          case 'body':
            params[param.name] = event.request.body;
            break;
          case 'query':
            // TODO cast qstring params
            if (param.type === 'object') {
              try {
                params[param.name] = JSON.parse(event.request.querystring[param.name]);
              } catch { 
                params[param.name] = 'error' // let the validator err
              }
            } else {
              params[param.name] = event.request.querystring[param.name];
            }
            break;
          case 'path':
            params[param.name] = event.request.path[param.name];
            break;
          case 'header':
            params[param.name] = event.request.headers[param.name];
            break;
          case 'formData':
          case 'multipart':
            if (param.type === 'file') {
              params[param.name] = event.request.files[param.name];
            } else {
              params[param.name] = event.request.body[param.name];
            }
            break;
          default:
        }
        if (param.type === 'array' && 'string' === typeof params[param.name]) {
          switch (param.collectionFormat) {
            case 'ssv':
              params[param.name] = params[param.name].split(' ');
              break;
            case 'tsv':
              params[param.name] = params[param.name].split('\t');
              break;
            case 'pipes':
              params[param.name] = params[param.name].split('|');
              break;
            default:
              params[param.name] = params[param.name].split(',');
          }
        }
      });
    }
  } else {
    params = event;
  }
  return params;
};
