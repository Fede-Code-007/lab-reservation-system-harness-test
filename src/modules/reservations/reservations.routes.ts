import type { Db } from '../../db/database.js';
import type { TypeboxApp } from '../../types.js';
import {
  CreateReservationBodySchema,
  ErrorResponseSchema,
  ReservationListQuerySchema,
  ReservationListResponseSchema,
  ReservationParamsSchema,
  ReservationSchema,
} from '../../schemas/index.js';
import { createEquipmentRepository } from '../equipment/equipment.repository.js';
import { createReservationRepository } from './reservations.repository.js';
import { createReservationService } from './reservations.service.js';

export function registerReservationsRoutes(app: TypeboxApp, db: Db): void {
  const service = createReservationService({
    reservations: createReservationRepository(db),
    equipment: createEquipmentRepository(db),
  });

  app.get(
    '/reservations',
    {
      schema: {
        querystring: ReservationListQuerySchema,
        response: {
          200: ReservationListResponseSchema,
          400: ErrorResponseSchema,
        },
      },
    },
    async (request) => service.list(request.query),
  );

  app.post(
    '/reservations',
    {
      schema: {
        body: CreateReservationBodySchema,
        response: {
          201: ReservationSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      reply.status(201);
      return service.create(request.body);
    },
  );

  app.get(
    '/reservations/:id',
    {
      schema: {
        params: ReservationParamsSchema,
        response: {
          200: ReservationSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => service.getById(request.params.id),
  );

  app.post(
    '/reservations/:id/cancel',
    {
      schema: {
        params: ReservationParamsSchema,
        response: {
          200: ReservationSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
        },
      },
    },
    async (request) => service.cancel(request.params.id),
  );
}
