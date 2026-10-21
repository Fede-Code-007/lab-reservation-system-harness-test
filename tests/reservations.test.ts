import { describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './helpers/test-app.js';
import {
  cancelReservation,
  createReservation,
  postReservation,
  validPayload,
} from './helpers/reservations.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function reservationRows(context: TestContext): unknown[] {
  return context.db.prepare('SELECT * FROM reservations ORDER BY created_at, id').all();
}

describe('POST /reservations', () => {
  it('responde 400 VALIDATION_ERROR si faltan campos obligatorios', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { equipmentId: 'MIC-01' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si el solicitante solo contiene espacios', async () => {
    const context = await createTestContext();
    try {
      const response = await postReservation(context, { ...validPayload, requester: '   ' });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si las fechas no tienen zona horaria explícita', async () => {
    const context = await createTestContext();
    try {
      const response = await postReservation(context, {
        ...validPayload,
        startAt: '2026-11-02T10:00:00',
        endAt: '2026-11-02T11:00:00',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await context.close();
    }
  });

  it('CA-01: crea una reserva ACTIVE, la persiste y la devuelve normalizada a UTC', async () => {
    const context = await createTestContext();
    try {
      const response = await postReservation(context, validPayload);

      expect(response.statusCode).toBe(201);
      const created = response.json();
      expect(created.id).toMatch(UUID_PATTERN);
      expect(created).toMatchObject({
        equipmentId: 'MIC-01',
        requester: 'Ana Ficticia',
        startAt: '2026-11-02T13:00:00.000Z',
        endAt: '2026-11-02T14:00:00.000Z',
        status: 'ACTIVE',
        cancelledAt: null,
      });
      expect(created.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const rows = reservationRows(context) as Array<{ id: string; status: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: created.id, status: 'ACTIVE' });
    } finally {
      await context.close();
    }
  });

  it('CA-02: rechaza con 409 OVERLAP una reserva superpuesta de la misma unidad', async () => {
    const context = await createTestContext();
    try {
      await createReservation(context, validPayload);

      const response = await postReservation(context, {
        ...validPayload,
        requester: 'Bruno Ficticio',
        startAt: '2026-11-02T10:30:00-03:00',
        endAt: '2026-11-02T11:30:00-03:00',
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: { code: 'OVERLAP' } });
      expect(reservationRows(context)).toHaveLength(1);
    } finally {
      await context.close();
    }
  });

  it('CA-03: acepta una reserva con limites consecutivos (11:00 a 12:00)', async () => {
    const context = await createTestContext();
    try {
      await createReservation(context, validPayload);

      const response = await postReservation(context, {
        ...validPayload,
        requester: 'Bruno Ficticio',
        startAt: '2026-11-02T11:00:00-03:00',
        endAt: '2026-11-02T12:00:00-03:00',
      });

      expect(response.statusCode).toBe(201);
      expect(reservationRows(context)).toHaveLength(2);
    } finally {
      await context.close();
    }
  });

  it('CA-04: acepta reservas simultaneas en unidades distintas (MIC-01 y MIC-02)', async () => {
    const context = await createTestContext();
    try {
      await createReservation(context, validPayload);

      const response = await postReservation(context, {
        ...validPayload,
        equipmentId: 'MIC-02',
        requester: 'Bruno Ficticio',
      });

      expect(response.statusCode).toBe(201);
      expect(reservationRows(context)).toHaveLength(2);
    } finally {
      await context.close();
    }
  });

  it('CA-05: rechaza con 400 un solicitante vacio', async () => {
    const context = await createTestContext();
    try {
      const response = await postReservation(context, { ...validPayload, requester: '' });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await context.close();
    }
  });

  it('CA-05: rechaza con 400 una fecha que no existe en el calendario', async () => {
    const context = await createTestContext();
    try {
      const response = await postReservation(context, {
        ...validPayload,
        startAt: '2026-02-30T10:00:00-03:00',
        endAt: '2026-02-30T11:00:00-03:00',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(reservationRows(context)).toHaveLength(0);
    } finally {
      await context.close();
    }
  });

  it('CA-05: rechaza con 400 un inicio igual al fin', async () => {
    const context = await createTestContext();
    try {
      const response = await postReservation(context, {
        ...validPayload,
        startAt: '2026-11-02T10:00:00-03:00',
        endAt: '2026-11-02T10:00:00-03:00',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await context.close();
    }
  });

  it('CA-05: rechaza con 400 un inicio posterior al fin', async () => {
    const context = await createTestContext();
    try {
      const response = await postReservation(context, {
        ...validPayload,
        startAt: '2026-11-02T11:00:00-03:00',
        endAt: '2026-11-02T10:00:00-03:00',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await context.close();
    }
  });

  it('CA-05: responde 404 NOT_FOUND si la unidad no existe', async () => {
    const context = await createTestContext();
    try {
      const response = await postReservation(context, { ...validPayload, equipmentId: 'MIC-99' });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
      expect(reservationRows(context)).toHaveLength(0);
    } finally {
      await context.close();
    }
  });

  it('RN-01: valida el formato antes que la existencia de la unidad', async () => {
    const context = await createTestContext();
    try {
      const response = await postReservation(context, {
        ...validPayload,
        equipmentId: 'MIC-99',
        requester: '   ',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await context.close();
    }
  });

  it('RN-02: recorta el solicitante antes de guardarlo', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context, { ...validPayload, requester: '  Ana Ficticia  ' });

      expect(created.requester).toBe('Ana Ficticia');
    } finally {
      await context.close();
    }
  });

  it('RN-02: rechaza con 400 un solicitante de mas de 80 caracteres', async () => {
    const context = await createTestContext();
    try {
      const response = await postReservation(context, { ...validPayload, requester: 'A'.repeat(81) });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
      expect(reservationRows(context)).toHaveLength(0);
    } finally {
      await context.close();
    }
  });
});

describe('GET /reservations/:id', () => {
  it('CA-06: devuelve la reserva con su estado', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);

      const response = await context.app.inject({ method: 'GET', url: `/reservations/${created.id}` });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: created.id, status: 'ACTIVE' });
    } finally {
      await context.close();
    }
  });

  it('RN-01: una reserva inexistente responde 404 NOT_FOUND', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({ method: 'GET', url: '/reservations/no-existe' });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    } finally {
      await context.close();
    }
  });
});

describe('POST /reservations/:id/cancel', () => {
  it('CA-06: cancela la reserva conservando sus datos y libera el intervalo', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);

      const response = await cancelReservation(context, created.id);

      expect(response.statusCode).toBe(200);
      const cancelled = response.json();
      expect(cancelled).toMatchObject({
        id: created.id,
        equipmentId: created.equipmentId,
        requester: created.requester,
        startAt: created.startAt,
        endAt: created.endAt,
        createdAt: created.createdAt,
        status: 'CANCELLED',
      });
      expect(cancelled.cancelledAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

      const rows = reservationRows(context) as Array<{ id: string; status: string }>;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: created.id, status: 'CANCELLED' });

      const reutilizacion = await postReservation(context, {
        ...validPayload,
        requester: 'Bruno Ficticio',
      });
      expect(reutilizacion.statusCode).toBe(201);
    } finally {
      await context.close();
    }
  });

  it('RF-04: una reserva ya cancelada responde 409 ALREADY_CANCELLED y no modifica los datos', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);
      const first = await cancelReservation(context, created.id);
      expect(first.statusCode).toBe(200);
      const cancelledAt = (first.json() as { cancelledAt: string }).cancelledAt;

      const response = await cancelReservation(context, created.id);

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: { code: 'ALREADY_CANCELLED' } });

      const row = context.db.prepare('SELECT status, cancelled_at FROM reservations WHERE id = ?').get(created.id) as {
        status: string;
        cancelled_at: string | null;
      };
      expect(row).toEqual({ status: 'CANCELLED', cancelled_at: cancelledAt });
    } finally {
      await context.close();
    }
  });

  it('RN-01: cancelar una reserva inexistente responde 404 NOT_FOUND', async () => {
    const context = await createTestContext();
    try {
      const response = await cancelReservation(context, 'no-existe');

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    } finally {
      await context.close();
    }
  });
});

describe('GET /reservations', () => {
  it('RF-03: lista las reservas activas y canceladas, con filtro por equipmentId', async () => {
    const context = await createTestContext();
    try {
      const first = await createReservation(context, validPayload);
      await createReservation(context, { ...validPayload, equipmentId: 'MIC-02' });
      await cancelReservation(context, first.id);

      const all = await context.app.inject({ method: 'GET', url: '/reservations' });
      const filtered = await context.app.inject({ method: 'GET', url: '/reservations?equipmentId=MIC-01' });

      expect(all.statusCode).toBe(200);
      expect((all.json() as unknown[]).length).toBe(2);
      expect(filtered.statusCode).toBe(200);
      const filteredBody = filtered.json() as Array<{ id: string; status: string }>;
      expect(filteredBody).toHaveLength(1);
      expect(filteredBody[0]).toMatchObject({ id: first.id, status: 'CANCELLED' });
    } finally {
      await context.close();
    }
  });
});

describe('Errores del servidor', () => {
  it('responde 404 NOT_FOUND con el formato de error de la especificacion', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({ method: 'GET', url: '/ruta-inexistente' });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    } finally {
      await context.close();
    }
  });
});
