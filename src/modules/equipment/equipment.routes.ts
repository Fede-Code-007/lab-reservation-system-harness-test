import type { Db } from '../../db/database.js';
import type { TypeboxApp } from '../../types.js';
import {
  AvailabilityQuerySchema,
  AvailabilityResponseSchema,
  EquipmentListResponseSchema,
  EquipmentParamsSchema,
  ErrorResponseSchema,
} from '../../schemas/index.js';
import { createReservationRepository } from '../reservations/reservations.repository.js';
import { createEquipmentRepository } from './equipment.repository.js';
import { createEquipmentService } from './equipment.service.js';

export function registerEquipmentRoutes(app: TypeboxApp, db: Db): void {
  const service = createEquipmentService({
    equipment: createEquipmentRepository(db),
    reservations: createReservationRepository(db),
  });

  app.get(
    '/equipment',
    {
      schema: {
        response: {
          200: EquipmentListResponseSchema,
        },
      },
    },
    async () => service.listEquipment(),
  );

  app.get(
    '/equipment/:id/availability',
    {
      schema: {
        params: EquipmentParamsSchema,
        querystring: AvailabilityQuerySchema,
        response: {
          200: AvailabilityResponseSchema,
          400: ErrorResponseSchema,
          404: ErrorResponseSchema,
        },
      },
    },
    async (request) => {
      const { id } = request.params;
      const { start, end } = request.query;
      return service.checkAvailability({ equipmentId: id, start, end });
    },
  );
}
