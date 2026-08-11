const CONTAINER_KEYWORDS = new Set(['oneOf', 'anyOf', 'if', 'discriminator']);

const instancePathToField = (p) => p.replace(/^\//, '').replace(/\//g, '.');

export const mapAjvError = (err) => {
  const path = instancePathToField(err.instancePath ?? '');
  const basePath = path || undefined;
  const { keyword, params, message } = err;

  switch (keyword) {
    case 'type':
      return { field: path, validationMessage: 'is the wrong type' };
    case 'required': {
      const missing = params.missingProperty;
      return {
        field: basePath ? `${basePath}.${missing}` : missing,
        validationMessage: 'is required'
      };
    }
    case 'additionalProperties': {
      const extra = params.additionalProperty;
      return {
        field: basePath ? `${basePath}.${extra}` : extra,
        validationMessage: 'is an additional property'
      };
    }
    case 'pattern':
      return { field: path, validationMessage: 'pattern mismatch' };
    case 'format':
      return { field: path, validationMessage: `must be ${params.format} format` };
    case 'enum':
      return { field: path, validationMessage: `must be one of: ${params.allowedValues.join(', ')}` };
    case 'minimum':
      return { field: path, validationMessage: 'is less than minimum' };
    case 'maximum':
      return { field: path, validationMessage: 'is more than maximum' };
    case 'minLength':
      return { field: path, validationMessage: 'has less length than allowed' };
    case 'maxLength':
      return { field: path, validationMessage: 'has longer length than allowed' };
    case 'minItems':
      return { field: path, validationMessage: 'has less items than allowed' };
    case 'maxItems':
      return { field: path, validationMessage: 'has more items than allowed' };
    case 'uniqueItems':
      return { field: path, validationMessage: 'must be unique' };
    case 'multipleOf':
      return { field: path, validationMessage: 'has a remainder' };
    case 'minProperties':
      return { field: path, validationMessage: 'has less properties than allowed' };
    case 'maxProperties':
      return { field: path, validationMessage: 'has more properties than allowed' };
    case 'bravadoFile':
      return { field: path, validationMessage: 'is not a valid file' };
    case 'discriminator': {
      const { tag, tagValue } = params;
      if (tagValue !== undefined) {
        return { field: path, validationMessage: `has unknown ${tag} "${tagValue}"` };
      }
      return { field: path, validationMessage: `is missing required ${tag}` };
    }
    default:
      return { field: path, validationMessage: message };
  }
};

// Deprioritize container errors (oneOf/anyOf/if/discriminator) in favour of the specific
// leaf errors beneath them, sorted by shortest instancePath first.
export const prioritizeLeafErrors = (errors) => {
  if (errors.length === 1) { return errors; }
  const leaves = errors.filter((e) => !CONTAINER_KEYWORDS.has(e.keyword));
  const result = leaves.length ? leaves : errors;
  if (result.length === 1) { return result; }
  return result.slice().sort((a, b) => a.instancePath.length - b.instancePath.length);
};
