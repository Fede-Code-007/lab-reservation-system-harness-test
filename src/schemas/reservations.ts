import { Type } from '@fastify/type-provider-typebox';
import { IsoDateTimeSchema } from './common.js';

export const ReservationStatusSchema = Type.Union([Type.Literal('ACTIVE'), Type.Literal('CANCELLED')]);

export const ReservationSchema = Type.Object({
  id: Type.String(),
  equipmentId: Type.String(),
  requester: Type.String(),
  startAt: Type.String(),
  endAt: Type.String(),
  status: ReservationStatusSchema,
  createdAt: Type.String(),
  cancelledAt: Type.Union([Type.String(), Type.Null()]),
});

export const ReservationListResponseSchema = Type.Array(ReservationSchema);

export const ReservationParamsSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
});

export const ReservationListQuerySchema = Type.Object({
  equipmentId: Type.Optional(Type.String({ minLength: 1 })),
});

/**
 * El esquema de transporte comprueba únicamente la presencia de los campos.
 * Las reglas de negocio del solicitante (RN-02: no puede estar vacio ni
 * contener solo espacios, se recorta y admite hasta 80 caracteres) se aplican
 * en `reservations.service.ts`, que es la capa que decide sobre ellas.
 */
export const CreateReservationBodySchema = Type.Object({
  equipmentId: Type.String({ minLength: 1 }),
  requester: Type.String({ minLength: 1 }),
  startAt: IsoDateTimeSchema,
  endAt: IsoDateTimeSchema,
});
