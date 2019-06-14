const validator = require('is-my-json-valid');
const traverse = require('traverse');
const errors = require('./errors');

const buildParamSchema = function(param) {
  const schema = {};
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
};

module.exports = function(params, context) {
  const schema = {
    type: 'object',
    title: 'params',
    properties: {
      accessToken: { type: 'string' }
    },
    required: [],
    additionalProperties: false
  };
  const definedParams = [].concat(
    Array.isArray(context.api.params) ? context.api.params : [],
    Array.isArray(context.resource.params) ? context.resource.params: [],
    Array.isArray(context.action.params) ? context.action.params: []
  );
  if (Array.isArray(definedParams)) {
    definedParams.forEach(function(param) {
      if (param.schema) {
        if (param.schema.$ref) {
          const jsonPath = param.schema.$ref.replace(/^#\//, '').split('/');
          schema.properties[param.name] = traverse(context.api).get(jsonPath);
        } else {
          schema.properties[param.name] = param.schema;
        }
      } else if (param.type === 'file') {
        const potentialFile = params[param.name];
        if (!potentialFile || (typeof(potentialFile.constructor) !== 'function') || potentialFile.constructor.name !== 'File') {
          throw errors.Validation({
            field: param.name,
            validationMessage: 'is not a valid file'
          });
        }
        schema.properties[param.name] = { type: 'object' };
      } else if (param.type === 'stream') {
        // no checks, cache only :)
        schema.properties[param.name] = { type: 'object' };
      } else {
        schema.properties[param.name] = buildParamSchema(param);
      }
      if (param.required) {
        schema.required.push(param.name);
      }
    });
    const validate = validator(schema);
    if (!validate(params)) {
      throw errors.Validation({
        field: validate.errors[0].field.replace(/^data\./, ''),
        validationMessage: validate.errors[0].message
      });
    }
  }
};
