import type { Db } from '../../db/database.js';
import type { TypeboxApp } from '../../types.js';
import {
  CreateReservationBodySchema,
  ReservationListQuerySchema,
  ReservationListResponseSchema,
  ReservationParamsSchema,
  ReservationSchema,
} from '../../schemas/index.js';
import { createReservationRepository } from './reservations.repository.js';
import { createReservationService } from './reservations.service.js';

export function registerReservationsRoutes(app: TypeboxApp, db: Db): void {
  const service = createReservationService(createReservationRepository(db));

  app.get(
    '/reservations',
    {
      schema: {
        querystring: ReservationListQuerySchema,
        response: {
          200: ReservationListResponseSchema,
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
        },
      },
    },
    async (request) => service.create(request.body),
  );

  app.get(
    '/reservations/:id',
    {
      schema: {
        params: ReservationParamsSchema,
        response: {
          200: ReservationSchema,
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
        },
      },
    },
    async (request) => service.cancel(request.params.id),
  );
}
