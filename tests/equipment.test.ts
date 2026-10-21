import { describe, expect, it } from 'vitest';
import { createTestContext } from './helpers/test-app.js';

describe('GET /equipment', () => {
  it('responde 501 NOT_IMPLEMENTED hasta implementar el servicio de inventario', async () => {
    const context = await createTestContext();
    try {
      const response = await context.app.inject({ method: 'GET', url: '/equipment' });

      expect(response.statusCode).toBe(501);
      expect(response.json()).toMatchObject({ error: { code: 'NOT_IMPLEMENTED' } });
    } finally {
      await context.close();
    }
  });

  it.todo('CA-01 / RF-01: devuelve el inventario precargado de data/inventory.json');
  it.todo('RF-01: la consulta de inventario no modifica los datos almacenados');
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
