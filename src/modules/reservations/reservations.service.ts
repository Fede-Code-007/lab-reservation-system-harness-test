import { randomUUID } from 'node:crypto';
import {
  AlreadyCancelledError,
  NotFoundError,
  OverlapError,
  ValidationError,
} from '../../errors/index.js';
import { parseRequiredInstant } from '../../shared/iso-date.js';
import type { EquipmentRepository } from '../equipment/equipment.repository.js';
import type { Reservation, ReservationFilter, ReservationRepository } from './reservations.repository.js';

export interface CreateReservationInput {
  equipmentId: string;
  requester: string;
  startAt: string;
  endAt: string;
}

export interface ReservationServiceDependencies {
  reservations: ReservationRepository;
  equipment: EquipmentRepository;
}

export interface ReservationService {
  list(filter: ReservationFilter): Reservation[];
  getById(id: string): Reservation;
  create(input: CreateReservationInput): Reservation;
  cancel(id: string): Reservation;
}

const MAX_REQUESTER_LENGTH = 80;

/** RN-02: el solicitante se recorta y no puede estar vacio ni superar 80 caracteres. */
function normalizeRequester(requester: string): string {
  const normalized = requester.trim();
  if (normalized.length === 0) {
    throw new ValidationError('El solicitante no puede estar vacio ni contener solo espacios.');
  }
  if (normalized.length > MAX_REQUESTER_LENGTH) {
    throw new ValidationError(`El solicitante no puede superar los ${MAX_REQUESTER_LENGTH} caracteres.`);
  }
  return normalized;
}

/** RN-03: el inicio debe ser estrictamente anterior al fin. */
function assertInterval(startAt: string, endAt: string): void {
  if (Date.parse(startAt) >= Date.parse(endAt)) {
    throw new ValidationError('El inicio de la reserva debe ser anterior al fin.');
  }
}

export function createReservationService(dependencies: ReservationServiceDependencies): ReservationService {
  const { reservations, equipment } = dependencies;

  return {
    list(filter: ReservationFilter): Reservation[] {
      return reservations.list(filter);
    },

    getById(id: string): Reservation {
      const reservation = reservations.findById(id);
      if (reservation === undefined) {
        throw new NotFoundError(`No existe la reserva "${id}".`);
      }
      return reservation;
    },

    /**
     * RN-01: el orden de validacion es formato y campos (400), existencia de la
     * unidad (404) y conflicto de superposicion (409).
     */
    create(input: CreateReservationInput): Reservation {
      const requester = normalizeRequester(input.requester);
      const startAt = parseRequiredInstant(input.startAt, 'startAt');
      const endAt = parseRequiredInstant(input.endAt, 'endAt');
      assertInterval(startAt, endAt);

      if (equipment.findById(input.equipmentId) === undefined) {
        throw new NotFoundError(`No existe la unidad "${input.equipmentId}".`);
      }

      const reservation: Reservation = {
        id: randomUUID(),
        equipmentId: input.equipmentId,
        requester,
        startAt,
        endAt,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        cancelledAt: null,
      };

      // RN-07: la comprobacion de superposicion y la insercion ocurren dentro de
      // una misma transaccion para que no puedan quedar inconsistentes.
      return reservations.transaction(() => {
        const conflicts = reservations.findActiveConflicts(input.equipmentId, startAt, endAt);
        if (conflicts.length > 0) {
          throw new OverlapError(
            `La unidad "${input.equipmentId}" ya tiene una reserva activa para ese intervalo.`,
          );
        }
        reservations.insert(reservation);
        return reservation;
      });
    },

    /**
     * RF-04: la cancelacion conserva los datos originales, cambia el estado a
     * `CANCELLED` y nunca borra el registro.
     */
    cancel(id: string): Reservation {
      const reservation = reservations.findById(id);
      if (reservation === undefined) {
        throw new NotFoundError(`No existe la reserva "${id}".`);
      }
      if (reservation.status === 'CANCELLED') {
        throw new AlreadyCancelledError(`La reserva "${id}" ya se encuentra cancelada.`);
      }

      const cancelled = reservations.cancel(id, new Date().toISOString());
      if (cancelled === undefined) {
        throw new AlreadyCancelledError(`La reserva "${id}" ya se encuentra cancelada.`);
      }
      return cancelled;
    },
  };
}
