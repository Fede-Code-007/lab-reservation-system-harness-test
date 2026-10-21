import type { Db } from '../../db/database.js';
import { NotImplementedError } from '../../errors/index.js';

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
  insert(reservation: Reservation): void;
  cancel(id: string, cancelledAt: string): Reservation | undefined;
}

export function createReservationRepository(_db: Db): ReservationRepository {
  return {
    list(_filter: ReservationFilter): Reservation[] {
      throw new NotImplementedError('El repositorio de reservations');
    },
    findById(_id: string): Reservation | undefined {
      throw new NotImplementedError('El repositorio de reservations');
    },
    insert(_reservation: Reservation): void {
      throw new NotImplementedError('El repositorio de reservations');
    },
    cancel(_id: string, _cancelledAt: string): Reservation | undefined {
      throw new NotImplementedError('El repositorio de reservations');
    },
  };
}
