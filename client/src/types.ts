/**
 * Tipos del contrato de la API (SPEC.md §8).
 * El cliente solo replica la forma de los datos: no contiene reglas de negocio.
 */

export interface Equipment {
  id: string;
  name: string;
}

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

export interface Availability {
  equipmentId: string;
  start: string;
  end: string;
  available: boolean;
  conflicts: string[];
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

/** Campo del intervalo editable (inicio o fin). */
export type IntervalField = 'start' | 'end';
