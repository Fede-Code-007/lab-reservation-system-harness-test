import { Type } from '@fastify/type-provider-typebox';
import { ISO_INSTANT_PATTERN_SOURCE } from '../shared/iso-instant.js';

export const IsoDateTimeSchema = Type.String({
  pattern: ISO_INSTANT_PATTERN_SOURCE,
});

export const ErrorResponseSchema = Type.Object({
  error: Type.Object({
    code: Type.String(),
    message: Type.String(),
  }),
});
