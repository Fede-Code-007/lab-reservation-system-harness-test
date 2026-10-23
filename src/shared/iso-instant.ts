/**
 * Fuente unica del formato de instante ISO 8601 con zona explicita (`Z` o
 * desplazamiento `+/-HH:MM`).
 *
 * Se declara como cadena porque es el formato que exige el esquema de
 * transporte (`src/schemas/common.ts`). El analizador de este modulo usa la
 * expresion regular derivada de ella, de modo que ambas capas comparten
 * exactamente la misma definicion y no pueden divergir.
 *
 * Este modulo no importa nada: lo consumen tanto la capa de negocio
 * (`src/shared/iso-date.ts`) como los esquemas de transporte.
 *
 * RN-08: las fechas se reciben en ISO 8601 con zona explicita, se normalizan a
 * UTC y se guardan y devuelven como `YYYY-MM-DDTHH:mm:ss.sssZ`.
 */
export const ISO_INSTANT_PATTERN_SOURCE =
  '^(\\d{4})-(\\d{2})-(\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2})(?:\\.(\\d{1,3}))?)?(Z|[+-](\\d{2}):(\\d{2}))$';

/** Expresion regular derivada de {@link ISO_INSTANT_PATTERN_SOURCE}. */
export const ISO_INSTANT_PATTERN = new RegExp(ISO_INSTANT_PATTERN_SOURCE);

const MONTH_LENGTHS: readonly number[] = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return MONTH_LENGTHS[month - 1] ?? 0;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Convierte un instante ISO 8601 con zona explicita a UTC normalizado
 * (`YYYY-MM-DDTHH:mm:ss.sssZ`). Devuelve `null` si el valor no es un instante
 * valido: sin zona, con fecha inexistente (por ejemplo `2026-02-30`) o con
 * componentes fuera de rango.
 */
export function parseIsoToUtc(value: string): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = ISO_INSTANT_PATTERN.exec(value);
  if (match === null) {
    return null;
  }

  const year = toNumber(match[1]);
  const month = toNumber(match[2]);
  const day = toNumber(match[3]);
  const hour = toNumber(match[4]);
  const minute = toNumber(match[5]);
  const second = match[6] === undefined ? 0 : toNumber(match[6]);
  const millisecond = match[7] === undefined ? 0 : toNumber(match[7].padEnd(3, '0'));
  const zone = match[8] ?? 'Z';

  if (
    year === null ||
    month === null ||
    day === null ||
    hour === null ||
    minute === null ||
    second === null ||
    millisecond === null
  ) {
    return null;
  }

  if (month < 1 || month > 12) {
    return null;
  }
  if (day < 1 || day > daysInMonth(year, month)) {
    return null;
  }
  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  let offsetMinutes = 0;
  if (zone !== 'Z') {
    const offsetHours = toNumber(match[9]);
    const offsetRemainder = toNumber(match[10]);
    if (offsetHours === null || offsetRemainder === null) {
      return null;
    }
    if (offsetHours > 23 || offsetRemainder > 59) {
      return null;
    }
    offsetMinutes = (offsetHours * 60 + offsetRemainder) * (zone.startsWith('-') ? -1 : 1);
  }

  const instant = new Date(0);
  instant.setUTCFullYear(year, month - 1, day);
  instant.setUTCHours(hour, minute, second, millisecond);

  return new Date(instant.getTime() - offsetMinutes * 60_000).toISOString();
}
