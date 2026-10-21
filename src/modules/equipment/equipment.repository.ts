import type { Db } from '../../db/database.js';
import { NotImplementedError } from '../../errors/index.js';

export interface Equipment {
  id: string;
  name: string;
}

export interface EquipmentRepository {
  list(): Equipment[];
  findById(id: string): Equipment | undefined;
}

export function createEquipmentRepository(_db: Db): EquipmentRepository {
  return {
    list(): Equipment[] {
      throw new NotImplementedError('El repositorio de equipment');
    },
    findById(_id: string): Equipment | undefined {
      throw new NotImplementedError('El repositorio de equipment');
    },
  };
}
