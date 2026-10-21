/**
 * Conversión entre la hora local de la interfaz (America/Argentina/Buenos_Aires)
 * y los instantes UTC que exige la API (SPEC.md RF-06 y RN-08).
 *
 * Solo es traducción de zona horaria: no hay reglas de negocio en este módulo.
 */

export const LOCAL_TIME_ZONE = 'America/Argentina/Buenos_Aires';

const LOCAL_VALUE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(?::(\d{2}))?(?::(\d{2}))?$/;

function pad(value: number, size = 2): string {
  return String(value).padStart(size, '0');
}

function utcFromParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): number {
  const date = new Date(Date.UTC(2000, month - 1, day, hour, minute, second));
  date.setUTCFullYear(year);
  return date.getTime();
}

function partsOf(instant: Date, timeZone: string): Record<string, number> {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(instant)) {
    if (part.type === 'literal') {
      continue;
    }
    const numeric = Number(part.value);
    parts[part.type] = part.type === 'hour' ? numeric % 24 : numeric;
  }
  return parts;
}

/**
 * Desplazamiento de la zona horaria respecto de UTC, en milisegundos, para el
 * instante indicado.
 */
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = partsOf(instant, timeZone);
  const asUtc = utcFromParts(parts['year'] ?? 1970, parts['month'] ?? 1, parts['day'] ?? 1, parts['hour'] ?? 0, parts['minute'] ?? 0, parts['second'] ?? 0);
  return asUtc - instant.getTime();
}

/**
 * Convierte un valor local "YYYY-MM-DDTHH:mm" (o con segundos) de la zona
 * indicada al instante UTC equivalente, en formato ISO 8601 con "Z".
 * Devuelve null si el valor no es una fecha/hora válida.
 */
export function localDateTimeToUtcIso(localValue: string, timeZone: string = LOCAL_TIME_ZONE): string | null {
  const match = LOCAL_VALUE_PATTERN.exec(localValue.trim());
  if (match === null) {
    return null;
  }
  const [, year, month, day, hour, minute = '00', second = '00'] = match;
  const naive = utcFromParts(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
  if (Number.isNaN(naive)) {
    return null;
  }

  // Verifica que la fecha exista en el calendario (por ejemplo, 2026-02-30 no).
  const check = new Date(naive);
  if (
    check.getUTCFullYear() !== Number(year) ||
    check.getUTCMonth() + 1 !== Number(month) ||
    check.getUTCDate() !== Number(day)
  ) {
    return null;
  }

  let offset = timeZoneOffsetMs(new Date(naive), timeZone);
  let instant = naive - offset;
  const refinedOffset = timeZoneOffsetMs(new Date(instant), timeZone);
  if (refinedOffset !== offset) {
    offset = refinedOffset;
    instant = naive - offset;
  }
  return new Date(instant).toISOString();
}

/** Devuelve el valor local "YYYY-MM-DDTHH:mm" del instante indicado. */
export function utcIsoToLocalDateTime(utcIso: string, timeZone: string = LOCAL_TIME_ZONE): string {
  const instant = new Date(utcIso);
  if (Number.isNaN(instant.getTime())) {
    return utcIso;
  }
  const parts = partsOf(instant, timeZone);
  return `${pad(parts['year'] ?? 1970, 4)}-${pad(parts['month'] ?? 1)}-${pad(parts['day'] ?? 1)}T${pad(parts['hour'] ?? 0)}:${pad(parts['minute'] ?? 0)}`;
}

/** Devuelve la hora local actual en formato "YYYY-MM-DDTHH:mm". */
export function nowLocalDateTime(timeZone: string = LOCAL_TIME_ZONE): string {
  return utcIsoToLocalDateTime(new Date().toISOString(), timeZone);
}

/** Suma horas a un valor local y devuelve el nuevo valor local. */
export function addHoursToLocalDateTime(localValue: string, hours: number, timeZone: string = LOCAL_TIME_ZONE): string {
  const utcIso = localDateTimeToUtcIso(localValue, timeZone);
  if (utcIso === null) {
    return localValue;
  }
  const instant = new Date(new Date(utcIso).getTime() + hours * 3_600_000);
  return utcIsoToLocalDateTime(instant.toISOString(), timeZone);
}

/** Presenta un instante UTC en la zona local de la interfaz. */
export function formatUtcForDisplay(utcIso: string, timeZone: string = LOCAL_TIME_ZONE): string {
  const instant = new Date(utcIso);
  if (Number.isNaN(instant.getTime())) {
    return utcIso;
  }
  const parts = partsOf(instant, timeZone);
  const year = parts['year'] ?? 1970;
  const month = parts['month'] ?? 1;
  const day = parts['day'] ?? 1;
  const hour = parts['hour'] ?? 0;
  const minute = parts['minute'] ?? 0;
  return `${pad(day)}/${pad(month)}/${pad(year, 4)} ${pad(hour)}:${pad(minute)}`;
}
