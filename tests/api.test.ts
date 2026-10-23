import { describe, expect, it } from 'vitest';
import { createTestContext, type TestContext } from './helpers/test-app.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

/** Cuerpo literal de SPEC.md §8 ("Cuerpo de POST /reservations"). */
const SPEC_BODY = {
  equipmentId: 'MIC-01',
  requester: 'Ana Ficticia',
  startAt: '2026-11-02T10:00:00-03:00',
  endAt: '2026-11-02T11:00:00-03:00',
};

/** Inventario de SPEC.md §4, ordenado por id como lo devuelve la API. */
const SPEC_INVENTORY = [
  { id: 'FUE-01', name: 'Fuente de alimentación' },
  { id: 'MIC-01', name: 'Microscopio digital' },
  { id: 'MIC-02', name: 'Microscopio digital' },
  { id: 'MUL-01', name: 'Multímetro' },
  { id: 'OSC-01', name: 'Osciloscopio' },
];

function expectErrorEnvelope(body: unknown, code: string): void {
  expect(body).toEqual({
    error: {
      code,
      message: expect.any(String),
    },
  });
}

async function createReservation(
  context: TestContext,
  payload: Partial<typeof SPEC_BODY> = {},
): Promise<Record<string, unknown>> {
  const response = await context.app.inject({
    method: 'POST',
    url: '/reservations',
    payload: { ...SPEC_BODY, ...payload },
  });
  expect(response.statusCode).toBe(201);
  return response.json() as Record<string, unknown>;
}

describe('SPEC.md §8 — GET /equipment', () => {
  it('responde 200 con el inventario de SPEC.md §4 como arreglo JSON', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({ method: 'GET', url: '/equipment' });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      expect(response.json()).toEqual(SPEC_INVENTORY);
    } finally {
      await context.close();
    }
  });

  it('no modifica los datos almacenados (RF-01)', async () => {
    const context = await createTestContext();
    try {
      const before = context.db.prepare('SELECT id, name FROM equipment ORDER BY id').all();
      const reservationsBefore = context.db.prepare('SELECT count(*) AS c FROM reservations').get();

      await context.app.inject({ method: 'GET', url: '/equipment' });

      expect(context.db.prepare('SELECT id, name FROM equipment ORDER BY id').all()).toEqual(before);
      expect(context.db.prepare('SELECT count(*) AS c FROM reservations').get()).toEqual(reservationsBefore);
    } finally {
      await context.close();
    }
  });
});

describe('SPEC.md §8 — GET /equipment/:id/availability', () => {
  it('responde 200 con el formato de disponibilidad de la especificacion', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);

      const response = await context.app.inject({
        method: 'GET',
        url: '/equipment/MIC-01/availability?start=2026-11-02T10%3A30%3A00-03%3A00&end=2026-11-02T11%3A30%3A00-03%3A00',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        equipmentId: 'MIC-01',
        start: '2026-11-02T13:30:00.000Z',
        end: '2026-11-02T14:30:00.000Z',
        available: false,
        conflicts: [created.id],
      });
    } finally {
      await context.close();
    }
  });

  it('responde 200 con available true y conflicts vacio cuando la unidad esta libre', async () => {
    const context = await createTestContext();
    try {
      await createReservation(context);

      const response = await context.app.inject({
        method: 'GET',
        url: '/equipment/MIC-01/availability?start=2026-11-03T10%3A00%3A00-03%3A00&end=2026-11-03T11%3A00%3A00-03%3A00',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        equipmentId: 'MIC-01',
        start: '2026-11-03T13:00:00.000Z',
        end: '2026-11-03T14:00:00.000Z',
        available: true,
        conflicts: [],
      });
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si faltan los parametros temporales', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'GET',
        url: '/equipment/MIC-01/availability',
      });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si los instantes no tienen zona explicita (RN-08)', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'GET',
        url: '/equipment/MIC-01/availability?start=2026-11-02T10%3A00%3A00&end=2026-11-02T11%3A00%3A00',
      });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si el inicio es igual o posterior al fin (RN-03)', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'GET',
        url: '/equipment/MIC-01/availability?start=2026-11-02T11%3A00%3A00-03%3A00&end=2026-11-02T10%3A00%3A00-03%3A00',
      });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
    } finally {
      await context.close();
    }
  });

  it('responde 404 NOT_FOUND si la unidad no existe (RN-01)', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'GET',
        url: '/equipment/MIC-99/availability?start=2026-11-02T10%3A00%3A00-03%3A00&end=2026-11-02T11%3A00%3A00-03%3A00',
      });

      expect(response.statusCode).toBe(404);
      expectErrorEnvelope(response.json(), 'NOT_FOUND');
    } finally {
      await context.close();
    }
  });

  it('no modifica los datos almacenados', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);
      const before = context.db.prepare('SELECT * FROM reservations').all();

      await context.app.inject({
        method: 'GET',
        url: '/equipment/MIC-01/availability?start=2026-11-02T10%3A00%3A00-03%3A00&end=2026-11-02T11%3A00%3A00-03%3A00',
      });

      expect(context.db.prepare('SELECT * FROM reservations').all()).toEqual(before);
      expect(created.status).toBe('ACTIVE');
    } finally {
      await context.close();
    }
  });
});

describe('SPEC.md §8 — POST /reservations', () => {
  it('responde 201 con la reserva del ejemplo de la especificacion', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: SPEC_BODY,
      });

      expect(response.statusCode).toBe(201);
      expect(response.headers['content-type']).toContain('application/json');
      const body = response.json() as Record<string, unknown>;
      expect(body.id).toMatch(UUID_PATTERN);
      expect(body).toMatchObject({
        equipmentId: 'MIC-01',
        requester: 'Ana Ficticia',
        startAt: '2026-11-02T13:00:00.000Z',
        endAt: '2026-11-02T14:00:00.000Z',
        status: 'ACTIVE',
        cancelledAt: null,
      });
      expect(body.createdAt).toMatch(UTC_PATTERN);
    } finally {
      await context.close();
    }
  });

  it('persiste la reserva creada', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);

      const row = context.db.prepare('SELECT * FROM reservations WHERE id = ?').get(created.id) as {
        equipment_id: string;
        requester: string;
        start_at: string;
        end_at: string;
        status: string;
        cancelled_at: string | null;
      };
      expect(row).toMatchObject({
        equipment_id: 'MIC-01',
        requester: 'Ana Ficticia',
        start_at: '2026-11-02T13:00:00.000Z',
        end_at: '2026-11-02T14:00:00.000Z',
        status: 'ACTIVE',
        cancelled_at: null,
      });
    } finally {
      await context.close();
    }
  });

  it('CA-04: acepta el mismo intervalo en MIC-01 y MIC-02 (ejemplo MIC-01/MIC-02)', async () => {
    const context = await createTestContext();
    try {
      const mic01 = await createReservation(context, { equipmentId: 'MIC-01' });
      const mic02 = await createReservation(context, {
        equipmentId: 'MIC-02',
        requester: 'Bruno Ficticio',
      });

      expect(mic01.equipmentId).toBe('MIC-01');
      expect(mic02.equipmentId).toBe('MIC-02');
      expect(mic02.startAt).toBe(mic01.startAt);
      expect(mic02.endAt).toBe(mic01.endAt);
      expect(mic02.id).not.toBe(mic01.id);

      const disponibilidadMic01 = await context.app.inject({
        method: 'GET',
        url: '/equipment/MIC-01/availability?start=2026-11-02T10%3A00%3A00-03%3A00&end=2026-11-02T11%3A00%3A00-03%3A00',
      });
      const disponibilidadMic02 = await context.app.inject({
        method: 'GET',
        url: '/equipment/MIC-02/availability?start=2026-11-02T10%3A00%3A00-03%3A00&end=2026-11-02T11%3A00%3A00-03%3A00',
      });

      expect(disponibilidadMic01.json()).toMatchObject({ available: false, conflicts: [mic01.id] });
      expect(disponibilidadMic02.json()).toMatchObject({ available: false, conflicts: [mic02.id] });
    } finally {
      await context.close();
    }
  });

  it('CA-02: responde 409 OVERLAP ante una reserva superpuesta y no la persiste', async () => {
    const context = await createTestContext();
    try {
      await createReservation(context);

      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: {
          ...SPEC_BODY,
          requester: 'Bruno Ficticio',
          startAt: '2026-11-02T10:30:00-03:00',
          endAt: '2026-11-02T11:30:00-03:00',
        },
      });

      expect(response.statusCode).toBe(409);
      expectErrorEnvelope(response.json(), 'OVERLAP');
      expect(context.db.prepare('SELECT count(*) AS c FROM reservations').get()).toEqual({ c: 1 });
    } finally {
      await context.close();
    }
  });

  it('CA-03: acepta una reserva con limites consecutivos', async () => {
    const context = await createTestContext();
    try {
      await createReservation(context);

      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: {
          ...SPEC_BODY,
          requester: 'Bruno Ficticio',
          startAt: '2026-11-02T11:00:00-03:00',
          endAt: '2026-11-02T12:00:00-03:00',
        },
      });

      expect(response.statusCode).toBe(201);
      expect(context.db.prepare('SELECT count(*) AS c FROM reservations').get()).toEqual({ c: 2 });
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si faltan campos obligatorios', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { equipmentId: 'MIC-01' },
      });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si el solicitante solo contiene espacios (RN-02)', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { ...SPEC_BODY, requester: '   ' },
      });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
      // La regla de RN-02 se aplica en la capa de negocio y no en el esquema
      // de transporte, de modo que el mensaje identifica al solicitante.
      expect((response.json() as { error: { message: string } }).error.message).toMatch(/solicitante/i);
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si el solicitante es una cadena vacia (RN-02)', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { ...SPEC_BODY, requester: '' },
      });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
    } finally {
      await context.close();
    }
  });

  it('acepta campos adicionales en el cuerpo: SPEC.md no los prohibe', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { ...SPEC_BODY, notas: 'campo no definido por la especificacion' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.json()).not.toHaveProperty('notas');
    } finally {
      await context.close();
    }
  });

  it('RN-08: permite reservar un intervalo pasado y no impone limites de duracion ni de anticipacion', async () => {
    const context = await createTestContext();
    try {
      const pasado = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: {
          equipmentId: 'MIC-01',
          requester: 'Ana Ficticia',
          startAt: '2020-01-01T10:00:00-03:00',
          endAt: '2020-01-01T11:00:00-03:00',
        },
      });
      const largo = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: {
          equipmentId: 'MIC-02',
          requester: 'Ana Ficticia',
          startAt: '2026-11-02T10:00:00-03:00',
          endAt: '2026-11-12T10:00:00-03:00',
        },
      });
      const lejano = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: {
          equipmentId: 'OSC-01',
          requester: 'Ana Ficticia',
          startAt: '2099-01-01T10:00:00-03:00',
          endAt: '2099-01-01T11:00:00-03:00',
        },
      });

      expect(pasado.statusCode).toBe(201);
      expect((pasado.json() as { startAt: string }).startAt).toBe('2020-01-01T13:00:00.000Z');
      expect(largo.statusCode).toBe(201);
      expect((largo.json() as { endAt: string }).endAt).toBe('2026-11-12T13:00:00.000Z');
      expect(lejano.statusCode).toBe(201);
      expect((lejano.json() as { startAt: string }).startAt).toBe('2099-01-01T13:00:00.000Z');
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si el solicitante supera los 80 caracteres (RN-02)', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { ...SPEC_BODY, requester: 'A'.repeat(81) },
      });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si los instantes no tienen zona explicita (RN-08)', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: {
          ...SPEC_BODY,
          startAt: '2026-11-02T10:00:00',
          endAt: '2026-11-02T11:00:00',
        },
      });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si la fecha no existe en el calendario', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: {
          ...SPEC_BODY,
          startAt: '2026-02-30T10:00:00-03:00',
          endAt: '2026-02-30T11:00:00-03:00',
        },
      });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si el inicio es igual al fin (RN-03)', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: {
          ...SPEC_BODY,
          startAt: '2026-11-02T10:00:00-03:00',
          endAt: '2026-11-02T10:00:00-03:00',
        },
      });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si el cuerpo no es un objeto JSON', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        headers: { 'content-type': 'application/json' },
        payload: '"no soy un objeto"',
      });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
    } finally {
      await context.close();
    }
  });

  it('responde 404 NOT_FOUND si la unidad no existe (RN-01)', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { ...SPEC_BODY, equipmentId: 'MIC-99' },
      });

      expect(response.statusCode).toBe(404);
      expectErrorEnvelope(response.json(), 'NOT_FOUND');
      expect(context.db.prepare('SELECT count(*) AS c FROM reservations').get()).toEqual({ c: 0 });
    } finally {
      await context.close();
    }
  });

  it('RN-01: valida el formato antes que la existencia de la unidad', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { ...SPEC_BODY, equipmentId: 'MIC-99', requester: '   ' },
      });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
    } finally {
      await context.close();
    }
  });
});

describe('SPEC.md §8 — GET /reservations', () => {
  it('responde 200 con un arreglo vacio cuando no hay reservas', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({ method: 'GET', url: '/reservations' });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual([]);
    } finally {
      await context.close();
    }
  });

  it('responde 200 con las reservas activas y canceladas (RF-04)', async () => {
    const context = await createTestContext();
    try {
      const activa = await createReservation(context);
      const cancelada = await createReservation(context, {
        requester: 'Bruno Ficticio',
        startAt: '2026-11-02T12:00:00-03:00',
        endAt: '2026-11-02T13:00:00-03:00',
      });
      await context.app.inject({
        method: 'POST',
        url: `/reservations/${cancelada.id}/cancel`,
      });

      const response = await context.app.inject({ method: 'GET', url: '/reservations' });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Array<Record<string, unknown>>;
      expect(body).toHaveLength(2);
      expect(body[0]).toMatchObject({ id: activa.id, status: 'ACTIVE', cancelledAt: null });
      expect(body[1]).toMatchObject({ id: cancelada.id, status: 'CANCELLED' });
      expect(body[1]?.cancelledAt).toMatch(UTC_PATTERN);
    } finally {
      await context.close();
    }
  });

  it('filtra por equipmentId', async () => {
    const context = await createTestContext();
    try {
      const mic01 = await createReservation(context, { equipmentId: 'MIC-01' });
      await createReservation(context, { equipmentId: 'MIC-02', requester: 'Bruno Ficticio' });

      const response = await context.app.inject({
        method: 'GET',
        url: '/reservations?equipmentId=MIC-01',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Array<Record<string, unknown>>;
      expect(body).toHaveLength(1);
      expect(body[0]).toMatchObject({ id: mic01.id, equipmentId: 'MIC-01' });
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si el filtro esta vacio', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({ method: 'GET', url: '/reservations?equipmentId=' });

      expect(response.statusCode).toBe(400);
      expectErrorEnvelope(response.json(), 'VALIDATION_ERROR');
    } finally {
      await context.close();
    }
  });
});

describe('SPEC.md §8 — GET /reservations/:id', () => {
  it('responde 200 con la reserva consultada', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);

      const response = await context.app.inject({
        method: 'GET',
        url: `/reservations/${String(created.id)}`,
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual(created);
    } finally {
      await context.close();
    }
  });

  it('responde 404 NOT_FOUND si la reserva no existe', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'GET',
        url: '/reservations/no-existe',
      });

      expect(response.statusCode).toBe(404);
      expectErrorEnvelope(response.json(), 'NOT_FOUND');
    } finally {
      await context.close();
    }
  });
});

describe('SPEC.md §8 — POST /reservations/:id/cancel', () => {
  it('responde 200 con la reserva cancelada, conservando los datos originales', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);

      const response = await context.app.inject({
        method: 'POST',
        url: `/reservations/${String(created.id)}/cancel`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json() as Record<string, unknown>;
      expect(body).toMatchObject({
        id: created.id,
        equipmentId: created.equipmentId,
        requester: created.requester,
        startAt: created.startAt,
        endAt: created.endAt,
        createdAt: created.createdAt,
        status: 'CANCELLED',
      });
      expect(body.cancelledAt).toMatch(UTC_PATTERN);

      const row = context.db.prepare('SELECT status, cancelled_at FROM reservations WHERE id = ?').get(
        created.id,
      ) as { status: string; cancelled_at: string | null };
      expect(row.status).toBe('CANCELLED');
      expect(row.cancelled_at).toBe(body.cancelledAt);
    } finally {
      await context.close();
    }
  });

  it('no borra la reserva de la base de datos (RF-04)', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);

      await context.app.inject({
        method: 'POST',
        url: `/reservations/${String(created.id)}/cancel`,
      });

      expect(context.db.prepare('SELECT count(*) AS c FROM reservations').get()).toEqual({ c: 1 });
    } finally {
      await context.close();
    }
  });

  it('responde 409 ALREADY_CANCELLED al cancelar dos veces y no modifica los datos', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);
      const primera = await context.app.inject({
        method: 'POST',
        url: `/reservations/${String(created.id)}/cancel`,
      });
      expect(primera.statusCode).toBe(200);
      const cancelledAt = (primera.json() as { cancelledAt: string }).cancelledAt;

      const response = await context.app.inject({
        method: 'POST',
        url: `/reservations/${String(created.id)}/cancel`,
      });

      expect(response.statusCode).toBe(409);
      expectErrorEnvelope(response.json(), 'ALREADY_CANCELLED');

      const row = context.db.prepare('SELECT status, cancelled_at FROM reservations WHERE id = ?').get(
        created.id,
      ) as { status: string; cancelled_at: string | null };
      expect(row).toEqual({ status: 'CANCELLED', cancelled_at: cancelledAt });
    } finally {
      await context.close();
    }
  });

  it('responde 404 NOT_FOUND si la reserva no existe', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations/no-existe/cancel',
      });

      expect(response.statusCode).toBe(404);
      expectErrorEnvelope(response.json(), 'NOT_FOUND');
    } finally {
      await context.close();
    }
  });

  it('libera el intervalo: una nueva reserva en el mismo horario responde 201 (CA-06)', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);
      await context.app.inject({
        method: 'POST',
        url: `/reservations/${String(created.id)}/cancel`,
      });

      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { ...SPEC_BODY, requester: 'Bruno Ficticio' },
      });

      expect(response.statusCode).toBe(201);

      const disponibilidad = await context.app.inject({
        method: 'GET',
        url: '/equipment/MIC-01/availability?start=2026-11-02T10%3A00%3A00-03%3A00&end=2026-11-02T11%3A00%3A00-03%3A00',
      });
      expect(disponibilidad.json()).toMatchObject({ available: false });
    } finally {
      await context.close();
    }
  });

  it('acepta cualquier Content-Type porque el endpoint no define cuerpo (SPEC.md §8)', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);

      const response = await context.app.inject({
        method: 'POST',
        url: `/reservations/${String(created.id)}/cancel`,
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        payload: 'ignorado=1',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ id: created.id, status: 'CANCELLED' });
    } finally {
      await context.close();
    }
  });
});

describe('SPEC.md §8 — formato de error', () => {
  it('todas las respuestas de error usan el envelope { error: { code, message } }', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context);
      const overlapped = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: {
          ...SPEC_BODY,
          requester: 'Bruno Ficticio',
          startAt: '2026-11-02T10:30:00-03:00',
          endAt: '2026-11-02T11:30:00-03:00',
        },
      });
      expect(overlapped.statusCode).toBe(409);

      const primeraCancelacion = await context.app.inject({
        method: 'POST',
        url: `/reservations/${String(created.id)}/cancel`,
      });
      expect(primeraCancelacion.statusCode).toBe(200);

      const respuestas = [
        await context.app.inject({ method: 'GET', url: '/equipment/MIC-99/availability?start=2026-11-02T10%3A00%3A00-03%3A00&end=2026-11-02T11%3A00%3A00-03%3A00' }),
        await context.app.inject({ method: 'GET', url: '/reservations/no-existe' }),
        await context.app.inject({ method: 'POST', url: '/reservations', payload: {} }),
        await context.app.inject({
          method: 'POST',
          url: '/reservations',
          payload: { ...SPEC_BODY, equipmentId: 'MIC-99' },
        }),
        overlapped,
        await context.app.inject({ method: 'POST', url: `/reservations/${String(created.id)}/cancel` }),
        await context.app.inject({ method: 'GET', url: '/ruta-inexistente' }),
      ];

      for (const respuesta of respuestas) {
        expect(respuesta.statusCode).toBeGreaterThanOrEqual(400);
        expect(respuesta.headers['content-type']).toContain('application/json');
        const body = respuesta.json() as { error: { code: string; message: string } };
        expect(Object.keys(body)).toEqual(['error']);
        expect(Object.keys(body.error).sort()).toEqual(['code', 'message']);
        expect(body.error.code).toMatch(/^[A-Z_]+$/);
        expect(body.error.message.length).toBeGreaterThan(0);
      }
    } finally {
      await context.close();
    }
  });

  it('usa solo los codigos de error definidos en la especificacion', async () => {
    const context = await createTestContext();
    try {
      const codigos = new Set<string>();
      const respuestas = [
        await context.app.inject({ method: 'GET', url: '/equipment/MIC-99/availability?start=2026-11-02T10%3A00%3A00-03%3A00&end=2026-11-02T11%3A00%3A00-03%3A00' }),
        await context.app.inject({ method: 'GET', url: '/reservations/no-existe' }),
        await context.app.inject({ method: 'POST', url: '/reservations', payload: {} }),
        await context.app.inject({ method: 'POST', url: '/reservations', payload: { ...SPEC_BODY, equipmentId: 'MIC-99' } }),
      ];

      for (const respuesta of respuestas) {
        codigos.add((respuesta.json() as { error: { code: string } }).error.code);
      }

      expect([...codigos].sort()).toEqual(['NOT_FOUND', 'VALIDATION_ERROR']);
    } finally {
      await context.close();
    }
  });
});
