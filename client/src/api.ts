import type { ApiErrorBody, Availability, Equipment, Reservation } from './types';

/**
 * Error devuelto por la API. El mensaje que se muestra en la interfaz es
 * siempre el que envía la API (SPEC.md §8), sin reinterpretarlo.
 */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

function isApiErrorBody(payload: unknown): payload is ApiErrorBody {
  if (typeof payload !== 'object' || payload === null) {
    return false;
  }
  const candidate = payload as Partial<ApiErrorBody>;
  return (
    typeof candidate.error === 'object' &&
    candidate.error !== null &&
    typeof candidate.error.code === 'string' &&
    typeof candidate.error.message === 'string'
  );
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError('NETWORK_ERROR', 'No se pudo conectar con la API local.', 0);
  }

  const raw = await response.text();
  let payload: unknown = null;
  if (raw.length > 0) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    const apiError = isApiErrorBody(payload) ? payload.error : undefined;
    throw new ApiError(
      apiError?.code ?? 'UNKNOWN_ERROR',
      apiError?.message ?? `La API respondió con el estado HTTP ${response.status}.`,
      response.status,
    );
  }

  return payload as T;
}

export function listEquipment(): Promise<Equipment[]> {
  return request<Equipment[]>('/equipment');
}

export function checkAvailability(equipmentId: string, start: string, end: string): Promise<Availability> {
  const query = new URLSearchParams({ start, end });
  return request<Availability>(`/equipment/${encodeURIComponent(equipmentId)}/availability?${query.toString()}`);
}

export function listReservations(equipmentId?: string): Promise<Reservation[]> {
  const query = equipmentId === undefined ? '' : `?${new URLSearchParams({ equipmentId }).toString()}`;
  return request<Reservation[]>(`/reservations${query}`);
}

export function createReservation(body: {
  equipmentId: string;
  requester: string;
  startAt: string;
  endAt: string;
}): Promise<Reservation> {
  return request<Reservation>('/reservations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function cancelReservation(id: string): Promise<Reservation> {
  return request<Reservation>(`/reservations/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}
