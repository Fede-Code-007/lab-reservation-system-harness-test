import { describe, expect, it } from 'vitest';
import type { Db } from '../src/db/database.js';
import {
  AlreadyCancelledError,
  NotFoundError,
  OverlapError,
  ValidationError,
} from '../src/errors/index.js';
import { createEquipmentRepository } from '../src/modules/equipment/equipment.repository.js';
import { createReservationRepository } from '../src/modules/reservations/reservations.repository.js';
import { createReservationService } from '../src/modules/reservations/reservations.service.js';
import { createTestDatabase } from './helpers/test-app.js';

const validInput = {
  equipmentId: 'MIC-01',
  requester: 'Ana Ficticia',
  startAt: '2026-11-02T10:00:00-03:00',
  endAt: '2026-11-02T11:00:00-03:00',
};

function createService(db: Db) {
  return createReservationService({
    reservations: createReservationRepository(db),
    equipment: createEquipmentRepository(db),
  });
}

function rows(db: Db): Array<{ id: string; status: string }> {
  return db.prepare('SELECT id, status FROM reservations ORDER BY created_at, id').all() as Array<{
    id: string;
    status: string;
  }>;
}

describe('reservations.service - creacion (CA-01 a CA-04)', () => {
  it('CA-01: crea una reserva ACTIVE y la persiste', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);

      const reservation = service.create(validInput);

      expect(reservation).toMatchObject({
        equipmentId: 'MIC-01',
        requester: 'Ana Ficticia',
        startAt: '2026-11-02T13:00:00.000Z',
        endAt: '2026-11-02T14:00:00.000Z',
        status: 'ACTIVE',
        cancelledAt: null,
      });
      expect(reservation.id).not.toBe('');
      expect(rows(db)).toEqual([{ id: reservation.id, status: 'ACTIVE' }]);
    } finally {
      db.close();
    }
  });

  it('CA-02: lanza OverlapError ante una superposicion y no inserta la reserva', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);
      service.create(validInput);

      expect(() =>
        service.create({
          ...validInput,
          requester: 'Bruno Ficticio',
          startAt: '2026-11-02T10:30:00-03:00',
          endAt: '2026-11-02T11:30:00-03:00',
        }),
      ).toThrow(OverlapError);
      expect(rows(db)).toHaveLength(1);
    } finally {
      db.close();
    }
  });

  it('CA-03: acepta limites consecutivos (11:00 a 12:00)', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);
      service.create(validInput);

      const reservation = service.create({
        ...validInput,
        requester: 'Bruno Ficticio',
        startAt: '2026-11-02T11:00:00-03:00',
        endAt: '2026-11-02T12:00:00-03:00',
      });

      expect(reservation.status).toBe('ACTIVE');
      expect(rows(db)).toHaveLength(2);
    } finally {
      db.close();
    }
  });

  it('CA-04: acepta reservas simultaneas en unidades distintas', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);
      service.create(validInput);

      const reservation = service.create({ ...validInput, equipmentId: 'MIC-02' });

      expect(reservation.equipmentId).toBe('MIC-02');
      expect(rows(db)).toHaveLength(2);
    } finally {
      db.close();
    }
  });
});

describe('reservations.service - entradas invalidas (CA-05)', () => {
  it('rechaza un solicitante vacio', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);

      expect(() => service.create({ ...validInput, requester: '' })).toThrow(ValidationError);
      expect(rows(db)).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('rechaza un solicitante formado solo por espacios', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);

      expect(() => service.create({ ...validInput, requester: '   ' })).toThrow(ValidationError);
      expect(rows(db)).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('rechaza una fecha invalida', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);

      expect(() => service.create({ ...validInput, startAt: '2026-02-30T10:00:00-03:00' })).toThrow(ValidationError);
      expect(() => service.create({ ...validInput, startAt: '2026-13-01T10:00:00Z' })).toThrow(ValidationError);
      expect(() => service.create({ ...validInput, endAt: '2026-11-02T25:00:00-03:00' })).toThrow(ValidationError);
      expect(rows(db)).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('rechaza una fecha sin zona horaria explicita', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);

      expect(() => service.create({ ...validInput, startAt: '2026-11-02T10:00:00' })).toThrow(ValidationError);
      expect(() => service.create({ ...validInput, endAt: '2026-11-02T11:00:00' })).toThrow(ValidationError);
      expect(rows(db)).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('rechaza un inicio igual o posterior al fin', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);

      expect(() =>
        service.create({
          ...validInput,
          startAt: '2026-11-02T10:00:00-03:00',
          endAt: '2026-11-02T10:00:00-03:00',
        }),
      ).toThrow(ValidationError);
      expect(() =>
        service.create({
          ...validInput,
          startAt: '2026-11-02T11:00:00-03:00',
          endAt: '2026-11-02T10:00:00-03:00',
        }),
      ).toThrow(ValidationError);
      expect(rows(db)).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('rechaza una unidad inexistente con NotFoundError', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);

      expect(() => service.create({ ...validInput, equipmentId: 'MIC-99' })).toThrow(NotFoundError);
      expect(rows(db)).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('valida el formato antes que la existencia de la unidad (RN-01)', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);

      expect(() => service.create({ ...validInput, equipmentId: 'MIC-99', requester: '  ' })).toThrow(ValidationError);
    } finally {
      db.close();
    }
  });

  it('RN-02: recorta el solicitante y limita su longitud a 80 caracteres', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);

      const reservation = service.create({ ...validInput, requester: '  Ana Ficticia  ' });
      expect(reservation.requester).toBe('Ana Ficticia');

      const otroIntervalo = {
        startAt: '2026-11-02T12:00:00-03:00',
        endAt: '2026-11-02T13:00:00-03:00',
      };

      expect(() => service.create({ ...validInput, ...otroIntervalo, requester: 'A'.repeat(81) })).toThrow(
        ValidationError,
      );
      expect(() => service.create({ ...validInput, ...otroIntervalo, requester: `  ${'A'.repeat(80)}  ` })).not.toThrow();
    } finally {
      db.close();
    }
  });
});

describe('reservations.service - cancelacion (CA-06)', () => {
  it('cancela conservando los datos originales y libera el intervalo', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);
      const created = service.create(validInput);

      const cancelled = service.cancel(created.id);

      expect(cancelled).toMatchObject({
        id: created.id,
        equipmentId: created.equipmentId,
        requester: created.requester,
        startAt: created.startAt,
        endAt: created.endAt,
        createdAt: created.createdAt,
        status: 'CANCELLED',
      });
      expect(cancelled.cancelledAt).not.toBeNull();

      const row = db.prepare('SELECT status, cancelled_at FROM reservations WHERE id = ?').get(created.id) as {
        status: string;
        cancelled_at: string | null;
      };
      expect(row.status).toBe('CANCELLED');
      expect(row.cancelled_at).not.toBeNull();

      expect(() => service.create({ ...validInput, requester: 'Bruno Ficticio' })).not.toThrow();
    } finally {
      db.close();
    }
  });

  it('no permite cancelar dos veces la misma reserva', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);
      const created = service.create(validInput);
      const first = service.cancel(created.id);

      expect(() => service.cancel(created.id)).toThrow(AlreadyCancelledError);

      const row = db.prepare('SELECT status, cancelled_at FROM reservations WHERE id = ?').get(created.id) as {
        status: string;
        cancelled_at: string | null;
      };
      expect(row).toEqual({ status: 'CANCELLED', cancelled_at: first.cancelledAt });
    } finally {
      db.close();
    }
  });

  it('rechaza con NotFoundError una reserva inexistente', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);

      expect(() => service.cancel('no-existe')).toThrow(NotFoundError);
    } finally {
      db.close();
    }
  });
});

describe('reservations.service - consulta', () => {
  it('devuelve 404 NotFoundError al consultar una reserva inexistente', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);

      expect(() => service.getById('no-existe')).toThrow(NotFoundError);
    } finally {
      db.close();
    }
  });

  it('lista las reservas de una unidad y filtra por equipmentId', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);
      const first = service.create(validInput);
      service.create({ ...validInput, equipmentId: 'MIC-02' });
      service.cancel(first.id);

      const all = service.list({});
      const mic01 = service.list({ equipmentId: 'MIC-01' });

      expect(all).toHaveLength(2);
      expect(mic01).toHaveLength(1);
      expect(mic01[0]).toMatchObject({ id: first.id, status: 'CANCELLED' });
    } finally {
      db.close();
    }
  });
});

describe('reservations.repository - transaccion (RN-07)', () => {
  it('revierte los cambios cuando el trabajo de la transaccion falla', () => {
    const db = createTestDatabase();
    try {
      const repository = createReservationRepository(db);
      const service = createService(db);
      const created = service.create(validInput);

      expect(() =>
        repository.transaction(() => {
          service.cancel(created.id);
          throw new Error('fallo simulado');
        }),
      ).toThrow('fallo simulado');

      const row = db.prepare('SELECT status, cancelled_at FROM reservations WHERE id = ?').get(created.id) as {
        status: string;
        cancelled_at: string | null;
      };
      expect(row).toEqual({ status: 'ACTIVE', cancelled_at: null });
    } finally {
      db.close();
    }
  });

  it('la creacion de una reserva superpuesta no deja filas agregadas', () => {
    const db = createTestDatabase();
    try {
      const service = createService(db);
      service.create(validInput);

      expect(() =>
        service.create({
          ...validInput,
          startAt: '2026-11-02T10:30:00-03:00',
          endAt: '2026-11-02T11:30:00-03:00',
        }),
      ).toThrow(OverlapError);

      const count = db.prepare('SELECT count(*) AS total FROM reservations').get() as { total: number };
      expect(count.total).toBe(1);
    } finally {
      db.close();
    }
  });
});
