import type { Db } from '../../db/database.js';

export interface Equipment {
  id: string;
  name: string;
}

export interface EquipmentRepository {
  list(): Equipment[];
  findById(id: string): Equipment | undefined;
}

interface EquipmentRow {
  id: string;
  name: string;
}

function toEquipment(row: EquipmentRow): Equipment {
  return { id: row.id, name: row.name };
}

export function createEquipmentRepository(db: Db): EquipmentRepository {
  return {
    list(): Equipment[] {
      const rows = db.prepare('SELECT id, name FROM equipment ORDER BY id').all() as EquipmentRow[];
      return rows.map(toEquipment);
    },

    findById(id: string): Equipment | undefined {
      const row = db.prepare('SELECT id, name FROM equipment WHERE id = ?').get(id) as EquipmentRow | undefined;
      return row === undefined ? undefined : toEquipment(row);
    },
  };
}
