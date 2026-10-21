import type { Db } from '../../db/database.js';
import type { TypeboxApp } from '../../types.js';
import {
  AvailabilityQuerySchema,
  AvailabilityResponseSchema,
  EquipmentListResponseSchema,
  EquipmentParamsSchema,
} from '../../schemas/index.js';
import { createEquipmentRepository } from './equipment.repository.js';
import { createEquipmentService } from './equipment.service.js';

export function registerEquipmentRoutes(app: TypeboxApp, db: Db): void {
  const service = createEquipmentService(createEquipmentRepository(db));

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
