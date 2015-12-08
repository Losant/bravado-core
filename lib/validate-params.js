var validator = require('is-my-json-valid');
var traverse = require('traverse');
var errors = require('./errors');

module.exports = function (params, context) {
  var schema = {
    type: 'object',
    title: 'params',
    properties: {
      accessToken: { type: 'string' }
    },
    required: [],
    additionalProperties: false
  };
  var definedParams = [].concat(
    Array.isArray(context.api.params) ? context.api.params : [],
    Array.isArray(context.resource.params) ? context.resource.params: [],
    Array.isArray(context.action.params) ? context.action.params: []
  );
  if (Array.isArray(definedParams)) {
    definedParams.forEach(function (param) {
      if (param.schema) {
        if (param.schema.$ref) {
          var jsonPath = param.schema.$ref.replace(/^#\//, '').split('/');
          schema.properties[param.name] = traverse(context.api).get(jsonPath);
        } else {
          schema.properties[param.name] = param.schema;
        }
      } else {
        schema.properties[param.name] = buildParamSchema(param);
      }
      if (param.required) {
        schema.required.push(param.name);
      }
    });
    var validate = validator(schema);
    if (!validate(params)) {
      throw errors.Validation({
        field: validate.errors[0].field.replace(/^data\./, ''),
        validationMessage: validate.errors[0].message
      });
    }
  }
};

function buildParamSchema (param) {
  var schema = {};
  if ('undefined' !== typeof param.type) { schema.type = param.type; }
  if ('undefined' !== typeof param.format) { schema.format = param.format; }
  if ('undefined' !== typeof param.default) { schema.default = param.default; }
  if ('undefined' !== typeof param.maximum) { schema.maximum = param.maximum; }
  if ('undefined' !== typeof param.exclusiveMaximum) { schema.exclusiveMaximum = param.exclusiveMaximum; }
  if ('undefined' !== typeof param.minimum) { schema.minimum = param.minimum; }
  if ('undefined' !== typeof param.exclusiveMinimum) { schema.exclusiveMinimum = param.exclusiveMinimum; }
  if ('undefined' !== typeof param.maxLength) { schema.maxLength = param.maxLength; }
  if ('undefined' !== typeof param.minLength) { schema.minLength = param.minLength; }
  if ('undefined' !== typeof param.pattern) { schema.pattern = param.pattern; }
  if ('undefined' !== typeof param.enum) { schema.enum = param.enum; }
  if ('undefined' !== typeof param.items) { schema.items = param.items; }
  if ('undefined' !== typeof param.maxItems) { schema.maxItems = param.maxItems; }
  if ('undefined' !== typeof param.minItems) { schema.minItems = param.minItems; }
  if ('undefined' !== typeof param.uniqueItems) { schema.uniqueItems = param.uniqueItems; }
  if ('undefined' !== typeof param.multipleOf) { schema.multipleOf = param.multipleOf; }
  return schema;
}