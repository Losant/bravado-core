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

export default function(event, context) {
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
        if (params[param.name] !== undefined) { return; }
        switch (param.in) {
          case 'body':
            params[param.name] = event.request.body;
            break;
          case 'query':
            // TODO cast qstring params
            params[param.name] = event.request.querystring[param.name];
            if (param.type === 'object') {
              try {
                params[param.name] = params[param.name] && JSON.parse(params[param.name]);
              } catch {
                params[param.name] = 'error'; // let the validator err
              }
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
              if (event.request.files) { params[param.name] = event.request.files[param.name]; }
            } else if (event.request.body) {
              params[param.name] = event.request.body[param.name];
              if (param.type === 'object') {
                try {
                  params[param.name] = params[param.name] && JSON.parse(params[param.name]);
                } catch {
                  params[param.name] = 'error'; // let the validator err
                }
              }
            }
            break;
          case 'bodyStream':
            params[param.name] = event.request.bodyStream;
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
}
