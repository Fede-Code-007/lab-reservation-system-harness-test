import { NotImplementedError } from '../../errors/index.js';
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

export interface EquipmentService {
  listEquipment(): Equipment[];
  checkAvailability(input: AvailabilityInput): AvailabilityResult;
}

export function createEquipmentService(repository: EquipmentRepository): EquipmentService {
  return {
    listEquipment(): Equipment[] {
      return repository.list();
    },
    checkAvailability(_input: AvailabilityInput): AvailabilityResult {
      throw new NotImplementedError('La consulta de disponibilidad');
    },
  };
}
