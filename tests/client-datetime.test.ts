import { describe, expect, it } from 'vitest';
import {
  addHoursToLocalDateTime,
  formatUtcForDisplay,
  localDateTimeToUtcIso,
  nowLocalDateTime,
  utcIsoToLocalDateTime,
} from '../client/src/lib/datetime.js';

/**
 * Conversión entre la hora local de la interfaz (America/Argentina/Buenos_Aires)
 * y el UTC que exige la API (SPEC.md RF-06 y RN-08).
 *
 * Estas pruebas viven en el proyecto raíz porque el cliente no incorpora un
 * ejecutor de pruebas propio: se reutiliza el Vitest ya instalado, sin
 * dependencias adicionales.
 */
describe('Zona horaria del cliente (RF-06)', () => {
  it('convierte una hora local de Buenos Aires a UTC', () => {
    expect(localDateTimeToUtcIso('2026-11-02T10:00')).toBe('2026-11-02T13:00:00.000Z');
  });

  it('convierte la medianoche local a UTC', () => {
    expect(localDateTimeToUtcIso('2026-11-02T00:00')).toBe('2026-11-02T03:00:00.000Z');
  });

  it('conserva los segundos cuando el valor local los incluye', () => {
    expect(localDateTimeToUtcIso('2026-11-02T10:00:30')).toBe('2026-11-02T13:00:30.000Z');
  });

  it('devuelve null para valores sin formato de fecha y hora', () => {
    expect(localDateTimeToUtcIso('')).toBeNull();
    expect(localDateTimeToUtcIso('2026-11-02')).toBeNull();
    expect(localDateTimeToUtcIso('no-es-una-fecha')).toBeNull();
  });

  it('devuelve null para fechas que no existen en el calendario', () => {
    expect(localDateTimeToUtcIso('2026-02-30T10:00')).toBeNull();
    expect(localDateTimeToUtcIso('2026-13-01T10:00')).toBeNull();
  });

  it('traduce un instante UTC a la hora local de Buenos Aires', () => {
    expect(utcIsoToLocalDateTime('2026-11-02T13:00:00.000Z')).toBe('2026-11-02T10:00');
    expect(utcIsoToLocalDateTime('2026-11-02T03:00:00.000Z')).toBe('2026-11-02T00:00');
  });

  it('suma horas sobre el valor local', () => {
    expect(addHoursToLocalDateTime('2026-11-02T10:00', 1)).toBe('2026-11-02T11:00');
    expect(addHoursToLocalDateTime('2026-11-02T23:30', 1)).toBe('2026-11-03T00:30');
  });

  it('muestra el instante UTC en la hora local de Buenos Aires', () => {
    expect(formatUtcForDisplay('2026-11-02T13:00:00.000Z')).toBe('02/11/2026 10:00');
  });

  it('obtiene la hora local actual con el formato esperado para los inputs', () => {
    expect(nowLocalDateTime()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
  });
});
