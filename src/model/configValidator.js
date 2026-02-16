function typeMatches(value, expected) {
  if (expected === 'array') return Array.isArray(value);
  if (expected === 'number') return typeof value === 'number' && !Number.isNaN(value);
  if (expected === 'object') return value && typeof value === 'object' && !Array.isArray(value);
  if (expected === 'string') return typeof value === 'string';
  return true;
}

export function validateAgainstSchema(config, schema, basePath = '') {
  const errors = [];
  const path = basePath || '/';

  if (schema.type && !typeMatches(config, schema.type)) {
    return [`${path} should be ${schema.type}`];
  }

  if (schema.required && schema.type === 'object') {
    for (const key of schema.required) {
      if (config?.[key] === undefined) errors.push(`${path}${key} is required`);
    }
  }

  if (schema.properties && config && typeof config === 'object' && !Array.isArray(config)) {
    for (const [key, subSchema] of Object.entries(schema.properties)) {
      if (config[key] !== undefined) {
        errors.push(...validateAgainstSchema(config[key], subSchema, `${path}${key}/`));
      }
    }
  }

  if (schema.additionalProperties && config && typeof config === 'object' && !Array.isArray(config)) {
    for (const [key, val] of Object.entries(config)) {
      if (!schema.properties || !(key in schema.properties)) {
        errors.push(...validateAgainstSchema(val, schema.additionalProperties, `${path}${key}/`));
      }
    }
  }

  if (schema.minimum !== undefined && typeof config === 'number' && config < schema.minimum) {
    errors.push(`${path} should be >= ${schema.minimum}`);
  }
  if (schema.maximum !== undefined && typeof config === 'number' && config > schema.maximum) {
    errors.push(`${path} should be <= ${schema.maximum}`);
  }
  if (schema.exclusiveMinimum !== undefined && typeof config === 'number' && config <= schema.exclusiveMinimum) {
    errors.push(`${path} should be > ${schema.exclusiveMinimum}`);
  }

  if (schema.minItems !== undefined && Array.isArray(config) && config.length < schema.minItems) {
    errors.push(`${path} should have at least ${schema.minItems} items`);
  }
  if (schema.items && Array.isArray(config)) {
    config.forEach((item, idx) => {
      errors.push(...validateAgainstSchema(item, schema.items, `${path}${idx}/`));
    });
  }

  return errors;
}
