import { Type } from '@fastify/type-provider-typebox';
import { IsoDateTimeSchema } from './common.js';

export const EquipmentSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
});

export const EquipmentListResponseSchema = Type.Array(EquipmentSchema);

export const EquipmentParamsSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});

export const AvailabilityQuerySchema = Type.Object({
  start: IsoDateTimeSchema,
  end: IsoDateTimeSchema,
});

export const AvailabilityResponseSchema = Type.Object({
  equipmentId: Type.String(),
  start: Type.String(),
  end: Type.String(),
  available: Type.Boolean(),
  conflicts: Type.Array(Type.String()),
});
