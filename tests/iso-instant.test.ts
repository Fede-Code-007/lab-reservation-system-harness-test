import { describe, expect, it } from 'vitest';
import { Compile } from 'typebox/compile';
import { IsoDateTimeSchema } from '../src/schemas/common.js';
import { ISO_INSTANT_PATTERN, ISO_INSTANT_PATTERN_SOURCE, parseIsoToUtc } from '../src/shared/iso-instant.js';
import { createTestContext } from './helpers/test-app.js';

/**
 * Verificaciones sobre el formato de instante ISO 8601 (RN-08).
 *
 * El patron de formato vive en `src/shared/iso-instant.ts` y lo usan tanto los
 * esquemas de transporte como la capa de negocio. Estas pruebas comprueban que
 * ambas capas no pueden divergir: la API acepta exactamente los instantes que
 * la capa de negocio considera validos.
 */

/** Instantes que no cumplen el formato ISO 8601 con zona explicita. */
const MALFORMED_INSTANTS: string[] = [
  '2026-11-02T10:00:00',
  '2026-11-02T10:00',
  '2026-11-02T10:00:00.000',
  '2026-11-02',
  '2026-11-02 10:00:00Z',
  '2026-11-02T10:00:00.1234Z',
];

/**
 * Instantes con formato valido que la capa de negocio rechaza porque no
 * existen en el calendario o el desplazamiento es invalido. El patron de
 * transporte los acepta: la comprobacion del calendario es responsabilidad de
 * la capa de negocio.
 */
const NON_CALENDAR_INSTANTS: string[] = [
  '2026-02-30T10:00:00-03:00',
  '2026-13-01T10:00:00Z',
  '2026-11-02T25:00:00Z',
  '2026-11-02T10:60:00Z',
  '2026-02-29T10:00:00Z',
  '2026-11-02T10:00:00+99:00',
];

const INVALID_INSTANTS: string[] = [...MALFORMED_INSTANTS, ...NON_CALENDAR_INSTANTS];

/** Instantes validos que la API debe aceptar y normalizar a UTC. */
const VALID_INSTANTS: Array<{ value: string; utc: string }> = [
  { value: '2026-11-02T10:00:00-03:00', utc: '2026-11-02T13:00:00.000Z' },
  { value: '2026-11-02T13:00:00Z', utc: '2026-11-02T13:00:00.000Z' },
  { value: '2026-11-02T10:00:00+03:00', utc: '2026-11-02T07:00:00.000Z' },
  { value: '2026-11-02T10:00:00.123Z', utc: '2026-11-02T10:00:00.123Z' },
  { value: '2026-11-02T10:00:00.1Z', utc: '2026-11-02T10:00:00.100Z' },
  { value: '2024-02-29T10:00:00Z', utc: '2024-02-29T10:00:00.000Z' },
];

/** Lee el patron declarado en un esquema de TypeBox sin recurrir a `any`. */
function patternOf(schema: object): string | undefined {
  const value = (schema as Record<string, unknown>)['pattern'];
  return typeof value === 'string' ? value : undefined;
}

describe('Instantes ISO 8601 (RN-08)', () => {
  it('el esquema de transporte usa el patron compartido con la capa de negocio', () => {
    expect(patternOf(IsoDateTimeSchema)).toBe(ISO_INSTANT_PATTERN_SOURCE);
    expect(ISO_INSTANT_PATTERN.source).toBe(ISO_INSTANT_PATTERN_SOURCE);
  });

  it('el esquema de transporte aplica el patron: rechaza lo que no cumple el formato', () => {
    // Mismo compilador que usa el validador de Fastify.
    const check = Compile(IsoDateTimeSchema);

    for (const value of MALFORMED_INSTANTS) {
      expect(check.Check(value), `valor: ${value}`).toBe(false);
    }
    for (const { value } of VALID_INSTANTS) {
      expect(check.Check(value), `valor: ${value}`).toBe(true);
    }
  });

  it('normaliza a UTC con el formato YYYY-MM-DDTHH:mm:ss.sssZ', () => {
    for (const { value, utc } of VALID_INSTANTS) {
      expect(parseIsoToUtc(value), `valor: ${value}`).toBe(utc);
    }
  });

  it('rechaza los instantes mal formados o con fecha inexistente', () => {
    for (const value of INVALID_INSTANTS) {
      expect(parseIsoToUtc(value), `valor: ${value}`).toBeNull();
    }
  });

  it('el patron compartido rechaza los instantes mal formados', () => {
    for (const value of MALFORMED_INSTANTS) {
      expect(ISO_INSTANT_PATTERN.test(value), `valor: ${value}`).toBe(false);
    }
  });

  it('el patron compartido acepta el formato de los instantes con calendario invalido', () => {
    for (const value of NON_CALENDAR_INSTANTS) {
      expect(ISO_INSTANT_PATTERN.test(value), `valor: ${value}`).toBe(true);
    }
  });
});

describe('Coherencia entre el transporte y la capa de negocio (RN-08)', () => {
  it('la API acepta exactamente los instantes que la capa de negocio considera validos', async () => {
    for (const { value, utc } of VALID_INSTANTS) {
      const context = await createTestContext();
      try {
        const endAt = new Date(Date.parse(utc) + 3_600_000).toISOString();
        const response = await context.app.inject({
          method: 'POST',
          url: '/reservations',
          payload: {
            equipmentId: 'MIC-01',
            requester: 'Ana Ficticia',
            startAt: value,
            endAt,
          },
        });

        expect(response.statusCode, `valor: ${value}`).toBe(201);
        expect((response.json() as { startAt: string }).startAt).toBe(utc);
      } finally {
        await context.close();
      }
    }
  });

  it('la API responde 400 ante cualquier instante que la capa de negocio rechaza', async () => {
    for (const value of INVALID_INSTANTS) {
      const context = await createTestContext();
      try {
        const response = await context.app.inject({
          method: 'POST',
          url: '/reservations',
          payload: {
            equipmentId: 'MIC-01',
            requester: 'Ana Ficticia',
            startAt: value,
            endAt: '2026-11-02T12:00:00-03:00',
          },
        });

        expect(response.statusCode, `valor: ${value}`).toBe(400);
        expect((response.json() as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
      } finally {
        await context.close();
      }
    }
  });
});
