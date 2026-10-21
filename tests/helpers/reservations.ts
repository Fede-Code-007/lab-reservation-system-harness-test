import { expect } from 'vitest';
import type { TestContext } from './test-app.js';

export interface ReservationPayload {
  equipmentId: string;
  requester: string;
  startAt: string;
  endAt: string;
}

export interface ReservationResponse {
  id: string;
  equipmentId: string;
  requester: string;
  startAt: string;
  endAt: string;
  status: 'ACTIVE' | 'CANCELLED';
  createdAt: string;
  cancelledAt: string | null;
}

export const validPayload: ReservationPayload = {
  equipmentId: 'MIC-01',
  requester: 'Ana Ficticia',
  startAt: '2026-11-02T10:00:00-03:00',
  endAt: '2026-11-02T11:00:00-03:00',
};

export function postReservation(context: TestContext, payload: ReservationPayload) {
  return context.app.inject({ method: 'POST', url: '/reservations', payload });
}

export async function createReservation(
  context: TestContext,
  payload: ReservationPayload = validPayload,
): Promise<ReservationResponse> {
  const response = await postReservation(context, payload);
  expect(response.statusCode).toBe(201);
  return response.json() as ReservationResponse;
}

export async function cancelReservation(context: TestContext, id: string) {
  return context.app.inject({ method: 'POST', url: `/reservations/${id}/cancel` });
}

export function availabilityUrl(start: string, end: string): string {
  return `/equipment/MIC-01/availability?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
}
