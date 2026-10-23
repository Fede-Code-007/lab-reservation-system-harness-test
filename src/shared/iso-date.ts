import { ValidationError } from '../errors/index.js';
import { parseIsoToUtc } from './iso-instant.js';

/**
 * Adapta el análisis de instantes ISO 8601 a la capa de negocio: convierte el
 * fallo en un error de validacion de la API (400) con un mensaje comprensible.
 *
 * La definición del formato y su normalizacion a UTC viven en
 * `src/shared/iso-instant.ts`, que es la fuente unica compartida con los
 * esquemas de transporte.
 */
export function parseRequiredInstant(value: string, field: string): string {
  const instant = parseIsoToUtc(value);
  if (instant === null) {
    throw new ValidationError(
      `El campo "${field}" debe ser un instante ISO 8601 valido con zona horaria explicita (por ejemplo 2026-11-02T10:00:00-03:00).`,
    );
  }
  return instant;
}
