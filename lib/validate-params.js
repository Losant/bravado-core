import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { mapAjvError, prioritizeLeafErrors } from './ajv-error-mapper.js';
import errors  from './errors.js';

const ajv = new Ajv({
  allErrors: true, strict: true, strictRequired: false, validateSchema: true, allowUnionTypes: true, allowMatchingProperties: true, discriminator: true
});
addFormats(ajv, { mode: 'fast' });
// ajv-formats v3 date-time (RFC 3339) requires a timezone; iso-date-time (ISO 8601) does not.
// Override to preserve backwards-compatible behaviour for clients that omit the offset.
ajv.addFormat('date-time', addFormats.get('iso-date-time'));

ajv.addKeyword({
  keyword: 'bravadoFile',
  schemaType: 'boolean',
  validate: (schema, data) => data && typeof data.constructor === 'function' && data.constructor.name === 'File',
  errors: false
});

const validators = new WeakMap(); // action object -> compiled validate fn

const buildParamSchema = function(param) {
  const schema = {};
  if ('undefined' !== typeof param.type) { schema.type = param.type; }
  if ('undefined' !== typeof param.format) { schema.format = param.format; }
  if ('undefined' !== typeof param.default) { schema.default = param.default; }
  if ('undefined' !== typeof param.maximum) { schema.maximum = param.maximum; }
  if ('undefined' !== typeof param.minimum) { schema.minimum = param.minimum; }
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

export default function(params, context) {
  let validate = validators.get(context.action);
  if (!validate) {
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
    definedParams.forEach(function(param) {
      if (param.schema) {
        schema.properties[param.name] = param.schema;
      } else if (param.type === 'file') {
        schema.properties[param.name] = { bravadoFile: true };
      } else if (param.type === 'stream') {
        schema.properties[param.name] = { type: 'object' };
      } else {
        schema.properties[param.name] = buildParamSchema(param);
      }
      if (param.required) {
        schema.required.push(param.name);
      }
    });
    if (context.api.definitions) { schema.definitions = context.api.definitions; }
    validate = ajv.compile(schema);
    validators.set(context.action, validate);
  }

  if (!validate(params)) {
    const mapped = prioritizeLeafErrors(validate.errors).map(mapAjvError);
    const { field, validationMessage } = mapped[0];
    throw errors.Validation({ field, validationMessage, validationErrors: mapped.length > 1 ? mapped : undefined });
  }
}
