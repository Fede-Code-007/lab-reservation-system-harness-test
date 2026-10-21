import type { Db } from '../../db/database.js';

export type ReservationStatus = 'ACTIVE' | 'CANCELLED';

export interface Reservation {
  id: string;
  equipmentId: string;
  requester: string;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  createdAt: string;
  cancelledAt: string | null;
}

export interface ReservationFilter {
  equipmentId?: string;
}

export interface ReservationRepository {
  list(filter: ReservationFilter): Reservation[];
  findById(id: string): Reservation | undefined;
  findActiveConflicts(equipmentId: string, startAt: string, endAt: string): Reservation[];
  insert(reservation: Reservation): void;
  cancel(id: string, cancelledAt: string): Reservation | undefined;
  transaction<T>(work: () => T): T;
}

interface ReservationRow {
  id: string;
  equipment_id: string;
  requester: string;
  start_at: string;
  end_at: string;
  status: ReservationStatus;
  created_at: string;
  cancelled_at: string | null;
}

const COLUMNS = 'id, equipment_id, requester, start_at, end_at, status, created_at, cancelled_at';

function toReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    equipmentId: row.equipment_id,
    requester: row.requester,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
  };
}

export function createReservationRepository(db: Db): ReservationRepository {
  const listAll = db.prepare(`SELECT ${COLUMNS} FROM reservations ORDER BY created_at ASC, id ASC`);
  const listByEquipment = db.prepare(
    `SELECT ${COLUMNS} FROM reservations WHERE equipment_id = ? ORDER BY created_at ASC, id ASC`,
  );
  const findById = db.prepare(`SELECT ${COLUMNS} FROM reservations WHERE id = ?`);
  const findActiveConflicts = db.prepare(
    `SELECT ${COLUMNS} FROM reservations
      WHERE equipment_id = @equipmentId
        AND status = 'ACTIVE'
        AND start_at < @newEnd
        AND end_at > @newStart
      ORDER BY start_at ASC, id ASC`,
  );
  const insert = db.prepare(
    `INSERT INTO reservations
       (id, equipment_id, requester, start_at, end_at, status, created_at, cancelled_at)
     VALUES
       (@id, @equipmentId, @requester, @startAt, @endAt, @status, @createdAt, @cancelledAt)`,
  );
  const cancel = db.prepare(
    `UPDATE reservations
        SET status = 'CANCELLED', cancelled_at = @cancelledAt
      WHERE id = @id AND status = 'ACTIVE'`,
  );

  function findReservation(id: string): Reservation | undefined {
    const row = findById.get(id) as ReservationRow | undefined;
    return row === undefined ? undefined : toReservation(row);
  }

  return {
    list(filter: ReservationFilter): Reservation[] {
      const rows =
        filter.equipmentId === undefined
          ? (listAll.all() as ReservationRow[])
          : (listByEquipment.all(filter.equipmentId) as ReservationRow[]);
      return rows.map(toReservation);
    },

    findById(id: string): Reservation | undefined {
      return findReservation(id);
    },

    /**
     * Reservas `ACTIVE` de la misma unidad que se superponen con el intervalo
     * `[startAt, endAt)`. El criterio es el de RN-04:
     * `inicio_nuevo < fin_existente AND fin_nuevo > inicio_existente`.
     * Los limites consecutivos no se superponen.
     */
    findActiveConflicts(equipmentId: string, startAt: string, endAt: string): Reservation[] {
      const rows = findActiveConflicts.all({ equipmentId, newStart: startAt, newEnd: endAt }) as ReservationRow[];
      return rows.map(toReservation);
    },

    insert(reservation: Reservation): void {
      insert.run({
        id: reservation.id,
        equipmentId: reservation.equipmentId,
        requester: reservation.requester,
        startAt: reservation.startAt,
        endAt: reservation.endAt,
        status: reservation.status,
        createdAt: reservation.createdAt,
        cancelledAt: reservation.cancelledAt,
      });
    },

    /**
     * Cancela la reserva actualizando su estado. No borra el registro.
     * Devuelve `undefined` si la reserva no existe o ya estaba cancelada.
     */
    cancel(id: string, cancelledAt: string): Reservation | undefined {
      const result = cancel.run({ id, cancelledAt });
      if (result.changes === 0) {
        return undefined;
      }
      return findReservation(id);
    },

    /**
     * Ejecuta `work` dentro de una transaccion de SQLite. Si `work` lanza una
     * excepcion, los cambios se revierten (RN-07).
     */
    transaction<T>(work: () => T): T {
      return db.transaction(work)();
    },
  };
}
