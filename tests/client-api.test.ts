import { afterEach, describe, expect, it } from 'vitest';
import {
  ApiError,
  cancelReservation,
  checkAvailability,
  createReservation,
  listEquipment,
  listReservations,
} from '../client/src/api.js';

/**
 * Capa de comunicacion del cliente React (RF-06 y SPEC.md §3).
 *
 * Estas pruebas viven en el proyecto raiz porque el cliente no incorpora un
 * ejecutor de pruebas propio: se reutiliza el Vitest ya instalado, sin
 * dependencias adicionales. Verifican que el cliente construye las
 * peticiones del contrato de SPEC.md §8 y que muestra el mensaje de error
 * que devuelve la API, sin reinterpretarlo.
 */

interface FetchCall {
  url: string;
  method: string;
  init: RequestInit | undefined;
}

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(
  handler: (call: FetchCall) => { status: number; body: string },
): { calls: FetchCall[] } {
  const calls: FetchCall[] = [];

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const call: FetchCall = {
      url: typeof input === 'string' ? input : input.toString(),
      method: init?.method ?? 'GET',
      init,
    };
    calls.push(call);
    const { status, body } = handler(call);
    return new Response(body, { status });
  }) as typeof globalThis.fetch;

  return { calls };
}

describe('Cliente React - construccion de peticiones (RF-06)', () => {
  it('lista el inventario con GET /equipment', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: '[{"id":"MIC-01","name":"Microscopio digital"}]' }));

    const equipment = await listEquipment();

    expect(equipment).toEqual([{ id: 'MIC-01', name: 'Microscopio digital' }]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.url).toBe('/equipment');
  });

  it('consulta la disponibilidad con GET /equipment/:id/availability y los parametros start y end', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: '{"available":true,"conflicts":[]}' }));

    const availability = await checkAvailability(
      'MIC-01',
      '2026-11-02T13:00:00.000Z',
      '2026-11-02T14:00:00.000Z',
    );

    expect(availability).toEqual({ available: true, conflicts: [] });
    expect(calls[0]?.method).toBe('GET');
    expect(calls[0]?.url).toBe(
      '/equipment/MIC-01/availability?start=2026-11-02T13%3A00%3A00.000Z&end=2026-11-02T14%3A00%3A00.000Z',
    );
  });

  it('escapa el identificador de la unidad en la URL', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: '{"available":true,"conflicts":[]}' }));

    await checkAvailability('MIC 01', '2026-11-02T13:00:00.000Z', '2026-11-02T14:00:00.000Z');

    expect(calls[0]?.url).toContain('/equipment/MIC%2001/availability');
  });

  it('lista el historial sin filtro y con filtro por equipmentId', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: '[]' }));

    await listReservations();
    await listReservations('MIC-01');

    expect(calls[0]?.url).toBe('/reservations');
    expect(calls[1]?.url).toBe('/reservations?equipmentId=MIC-01');
  });

  it('crea una reserva con POST /reservations y el cuerpo JSON de SPEC.md', async () => {
    const { calls } = mockFetch(() => ({ status: 201, body: '{"id":"abc","status":"ACTIVE"}' }));

    await createReservation({
      equipmentId: 'MIC-01',
      requester: 'Ana Ficticia',
      startAt: '2026-11-02T13:00:00.000Z',
      endAt: '2026-11-02T14:00:00.000Z',
    });

    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('/reservations');
    expect(calls[0]?.init?.headers).toMatchObject({ 'Content-Type': 'application/json' });
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      equipmentId: 'MIC-01',
      requester: 'Ana Ficticia',
      startAt: '2026-11-02T13:00:00.000Z',
      endAt: '2026-11-02T14:00:00.000Z',
    });
  });

  it('cancela una reserva con POST /reservations/:id/cancel', async () => {
    const { calls } = mockFetch(() => ({ status: 200, body: '{"id":"abc","status":"CANCELLED"}' }));

    await cancelReservation('abc');

    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('/reservations/abc/cancel');
  });
});

describe('Cliente React - traduccion de errores de la API (RF-06)', () => {
  it('muestra el codigo y el mensaje que devuelve la API', async () => {
    mockFetch(() => ({
      status: 409,
      body: '{"error":{"code":"OVERLAP","message":"La unidad \\"MIC-01\\" ya tiene una reserva activa."}}',
    }));

    const error = await listEquipment().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'OVERLAP',
      message: 'La unidad "MIC-01" ya tiene una reserva activa.',
      status: 409,
    });
  });

  it('usa un mensaje de respaldo cuando la respuesta de error no trae el envelope de SPEC.md', async () => {
    mockFetch(() => ({ status: 500, body: 'error interno' }));

    const error = await listEquipment().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'UNKNOWN_ERROR',
      message: 'La API respondió con el estado HTTP 500.',
      status: 500,
    });
  });

  it('informa un error de conexion cuando la API no esta disponible', async () => {
    globalThis.fetch = (async () => {
      throw new TypeError('fetch failed');
    }) as typeof globalThis.fetch;

    const error = await listEquipment().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 'NETWORK_ERROR',
      message: 'No se pudo conectar con la API local.',
      status: 0,
    });
  });
});
