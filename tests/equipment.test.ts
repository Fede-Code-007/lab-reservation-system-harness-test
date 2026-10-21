import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/index.js';
import { readInventory } from '../src/db/seed.js';
import { createTestContext } from './helpers/test-app.js';

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

  it.todo('RF-01: el inventario no se duplica cuando el servidor se reinicia');
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

  it.todo('CA-08: la disponibilidad coincide con las reglas aplicadas al crear una reserva');
  it.todo('RN-01: una unidad inexistente responde 404 NOT_FOUND');
});
