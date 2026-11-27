import { ApiError } from '../utils/ApiError.js';

/**
 * Validate the request with Zod schemas, one per part:
 *   validate({ body: createSchema, params: idSchema, query: listSchema })
 * Each part is optional. Parsed (coerced/stripped) values replace the originals.
 */
export const validate = (schemas) => (req, res, next) => {
  const errors = [];

  for (const part of ['params', 'query', 'body']) {
    const schema = schemas[part];
    if (!schema) continue;

    const result = schema.safeParse(req[part] ?? {});
    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({ location: part, field: issue.path.join('.'), message: issue.message });
      }
      continue;
    }

    // Express 5 exposes req.query as a getter, so redefine it instead of assigning.
    Object.defineProperty(req, part, {
      value: result.data,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  if (errors.length) return next(ApiError.badRequest('Validation failed', errors));
  next();
};
