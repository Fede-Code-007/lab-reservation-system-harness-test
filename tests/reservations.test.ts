import { describe, expect, it } from 'vitest';
import { createTestContext } from './helpers/test-app.js';

const validBody = {
  equipmentId: 'MIC-01',
  requester: 'Ana Ficticia',
  startAt: '2026-11-02T10:00:00-03:00',
  endAt: '2026-11-02T11:00:00-03:00',
};

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
      const response = await context.app.inject({
        method: 'POST',
        url: '/reservations',
        payload: { ...validBody, requester: '   ' },
      });

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
        method: 'POST',
        url: '/reservations',
        payload: { ...validBody, startAt: '2026-11-02T10:00:00', endAt: '2026-11-02T11:00:00' },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toMatchObject({ error: { code: 'VALIDATION_ERROR' } });
    } finally {
      await context.close();
    }
  });

  it.todo('CA-01: crea una reserva ACTIVE y la persiste');
  it.todo('CA-02: rechaza un solapamiento con 409 OVERLAP');
  it.todo('CA-03: acepta reservas con límites consecutivos');
  it.todo('CA-04: acepta reservas simultáneas en unidades distintas');
  it.todo('RN-02: recorta el solicitante y rechaza nombres de más de 80 caracteres');
  it.todo('RN-03: rechaza un inicio igual o posterior al fin');
});

describe('GET /reservations/:id', () => {
  it.todo('CA-06: devuelve la reserva con su estado');
  it.todo('RN-01: una reserva inexistente responde 404 NOT_FOUND');
});

describe('POST /reservations/:id/cancel', () => {
  it.todo('CA-06: cancela la reserva conservando sus datos originales');
  it.todo('CA-06: una reserva cancelada libera el intervalo para una nueva reserva');
  it.todo('RF-04: una reserva ya cancelada responde 409 ALREADY_CANCELLED');
});

describe('GET /reservations', () => {
  it.todo('RF-03: lista las reservas activas y canceladas, con filtro por equipmentId');
});

describe('Errores del servidor', () => {
  it('responde 404 NOT_FOUND con el formato de error de la especificación', async () => {
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
