import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/index.js';
import { readInventory } from '../src/db/seed.js';
import { createTestContext } from './helpers/test-app.js';
import { availabilityUrl, cancelReservation, createReservation, validPayload } from './helpers/reservations.js';

describe('GET /equipment', () => {
  it('devuelve el inventario precargado como arreglo JSON', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({ method: 'GET', url: '/equipment' });
      const body = response.json() as Array<{ id: string; name: string }>;
      const inventory = readInventory(loadConfig().inventoryFile);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(body)).toBe(true);
      expect(body).toHaveLength(inventory.length);
      for (const item of inventory) {
        expect(body).toContainEqual({ id: item.id, name: item.name });
      }
    } finally {
      await context.close();
    }
  });

  it('no modifica los datos almacenados', async () => {
    const context = await createTestContext();
    try {
      const before = context.db.prepare('SELECT id, name FROM equipment ORDER BY id').all();
      const reservationsBefore = context.db.prepare('SELECT count(*) AS c FROM reservations').get();

      const response = await context.app.inject({ method: 'GET', url: '/equipment' });

      const after = context.db.prepare('SELECT id, name FROM equipment ORDER BY id').all();
      const reservationsAfter = context.db.prepare('SELECT count(*) AS c FROM reservations').get();

      expect(response.statusCode).toBe(200);
      expect(after).toEqual(before);
      expect(reservationsAfter).toEqual(reservationsBefore);
    } finally {
      await context.close();
    }
  });
});

describe('GET /equipment/:id/availability', () => {
  it('responde 400 VALIDATION_ERROR si faltan los parámetros temporales', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({ method: 'GET', url: '/equipment/MIC-01/availability' });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si las fechas no tienen zona horaria explícita', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'GET',
        url: '/equipment/MIC-01/availability?start=2026-11-02T10:00:00&end=2026-11-02T11:00:00',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await context.close();
    }
  });

  it('CA-08: la disponibilidad coincide con las reglas aplicadas al crear una reserva', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context, validPayload);

      const solapado = await context.app.inject({
        method: 'GET',
        url: availabilityUrl('2026-11-02T10:30:00-03:00', '2026-11-02T11:30:00-03:00'),
      });
      const consecutivo = await context.app.inject({
        method: 'GET',
        url: availabilityUrl('2026-11-02T11:00:00-03:00', '2026-11-02T12:00:00-03:00'),
      });
      const libre = await context.app.inject({
        method: 'GET',
        url: availabilityUrl('2026-11-03T10:00:00-03:00', '2026-11-03T11:00:00-03:00'),
      });

      expect(solapado.statusCode).toBe(200);
      expect(solapado.json()).toMatchObject({
        equipmentId: 'MIC-01',
        start: '2026-11-02T13:30:00.000Z',
        end: '2026-11-02T14:30:00.000Z',
        available: false,
        conflicts: [created.id],
      });
      expect(consecutivo.statusCode).toBe(200);
      expect(consecutivo.json()).toMatchObject({ available: true, conflicts: [] });
      expect(libre.statusCode).toBe(200);
      expect(libre.json()).toMatchObject({ available: true, conflicts: [] });
    } finally {
      await context.close();
    }
  });

  it('CA-08: un intervalo informado como no disponible es rechazado al crear la reserva', async () => {
    const context = await createTestContext();
    try {
      await createReservation(context, validPayload);

      const availability = await context.app.inject({
        method: 'GET',
        url: availabilityUrl('2026-11-02T10:30:00-03:00', '2026-11-02T11:30:00-03:00'),
      });
      const body = availability.json() as { available: boolean; start: string; end: string };

      expect(body.available).toBe(false);

      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: {
          equipmentId: 'MIC-01',
          requester: 'Bruno Ficticio',
          startAt: body.start,
          endAt: body.end,
        },
      });

      expect(response.statusCode).toBe(409);
      expect(response.json()).toMatchObject({ error: { code: 'OVERLAP' } });
    } finally {
      await context.close();
    }
  });

  it('CA-06/RN-06: una reserva cancelada no bloquea el intervalo', async () => {
    const context = await createTestContext();
    try {
      const created = await createReservation(context, validPayload);
      await cancelReservation(context, created.id);

      const response = await context.app.inject({
        method: 'GET',
        url: availabilityUrl('2026-11-02T10:00:00-03:00', '2026-11-02T11:00:00-03:00'),
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ available: true, conflicts: [] });
    } finally {
      await context.close();
    }
  });

  it('RN-01: una unidad inexistente responde 404 NOT_FOUND', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'GET',
        url: '/equipment/MIC-99/availability?start=2026-11-02T10:00:00-03:00&end=2026-11-02T11:00:00-03:00',
      });

      expect(response.statusCode).toBe(404);
      expect(response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
    } finally {
      await context.close();
    }
  });

  it('responde 400 VALIDATION_ERROR si el inicio es igual o posterior al fin', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({
        method: 'GET',
        url: availabilityUrl('2026-11-02T11:00:00-03:00', '2026-11-02T10:00:00-03:00'),
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await context.close();
    }
  });
});
