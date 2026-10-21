import { NotImplementedError } from '../../errors/index.js';
import type {
  Reservation,
  ReservationFilter,
  ReservationRepository,
} from './reservations.repository.js';

export interface CreateReservationInput {
  equipmentId: string;
  requester: string;
  startAt: string;
  endAt: string;
}

export interface ReservationService {
  list(filter: ReservationFilter): Reservation[];
  getById(id: string): Reservation;
  create(input: CreateReservationInput): Reservation;
  cancel(id: string): Reservation;
}

export function createReservationService(repository: ReservationRepository): ReservationService {
  return {
    list(filter: ReservationFilter): Reservation[] {
      return repository.list(filter);
    },
    getById(_id: string): Reservation {
      throw new NotImplementedError('La consulta de una reserva');
    },
    create(_input: CreateReservationInput): Reservation {
      throw new NotImplementedError('La creación de reservas');
    },
    cancel(_id: string): Reservation {
      throw new NotImplementedError('La cancelación de reservas');
    },
  };
}
