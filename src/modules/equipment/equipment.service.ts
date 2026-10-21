import { NotFoundError, ValidationError } from '../../errors/index.js';
import { parseRequiredInstant } from '../../shared/iso-date.js';
import type { ReservationRepository } from '../reservations/reservations.repository.js';
import type { Equipment, EquipmentRepository } from './equipment.repository.js';

export interface AvailabilityInput {
  equipmentId: string;
  start: string;
  end: string;
}

export interface AvailabilityResult {
  equipmentId: string;
  start: string;
  end: string;
  available: boolean;
  conflicts: string[];
}

export interface EquipmentServiceDependencies {
  equipment: EquipmentRepository;
  reservations: ReservationRepository;
}

export interface EquipmentService {
  listEquipment(): Equipment[];
  checkAvailability(input: AvailabilityInput): AvailabilityResult;
}

export function createEquipmentService(dependencies: EquipmentServiceDependencies): EquipmentService {
  const { equipment, reservations } = dependencies;

  return {
    listEquipment(): Equipment[] {
      return equipment.list();
    },

    /**
     * RF-02/RN-07: la disponibilidad usa la misma comprobacion de
     * superposicion que la creacion de reservas, sobre las reservas `ACTIVE`
     * de la unidad (RN-06).
     */
    checkAvailability(input: AvailabilityInput): AvailabilityResult {
      const start = parseRequiredInstant(input.start, 'start');
      const end = parseRequiredInstant(input.end, 'end');
      if (Date.parse(start) >= Date.parse(end)) {
        throw new ValidationError('El inicio del intervalo debe ser anterior al fin.');
      }

      if (equipment.findById(input.equipmentId) === undefined) {
        throw new NotFoundError(`No existe la unidad "${input.equipmentId}".`);
      }

      const conflicts = reservations.findActiveConflicts(input.equipmentId, start, end);

      return {
        equipmentId: input.equipmentId,
        start,
        end,
        available: conflicts.length === 0,
        conflicts: conflicts.map((conflict) => conflict.id),
      };
    },
  };
}
