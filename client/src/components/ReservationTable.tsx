import { formatUtcForDisplay } from '../lib/datetime';
import type { Reservation } from '../types';

interface ReservationTableProps {
  reservations: Reservation[];
  equipmentNameById: Map<string, string>;
  onCancel: (reservationId: string) => void;
  cancellingId: string | null;
  loading: boolean;
}

export function ReservationTable({
  reservations,
  equipmentNameById,
  onCancel,
  cancellingId,
  loading,
}: ReservationTableProps) {
  return (
    <section className="panel">
      <h2>Reservas</h2>
      {loading && <p className="hint">Cargando reservas…</p>}
      {!loading && reservations.length === 0 && <p className="hint">No hay reservas para mostrar.</p>}
      {reservations.length > 0 && (
        <table className="table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Equipo</th>
              <th scope="col">Solicitante</th>
              <th scope="col">Inicio</th>
              <th scope="col">Fin</th>
              <th scope="col">Estado</th>
              <th scope="col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map((reservation) => (
              <tr key={reservation.id}>
                <td className="mono">{reservation.id}</td>
                <td>
                  {reservation.equipmentId}
                  {equipmentNameById.has(reservation.equipmentId)
                    ? ` — ${equipmentNameById.get(reservation.equipmentId) ?? ''}`
                    : ''}
                </td>
                <td>{reservation.requester}</td>
                <td>{formatUtcForDisplay(reservation.startAt)}</td>
                <td>{formatUtcForDisplay(reservation.endAt)}</td>
                <td>
                  <span
                    className={reservation.status === 'ACTIVE' ? 'status status-active' : 'status status-cancelled'}
                  >
                    {reservation.status === 'ACTIVE' ? 'Activa' : 'Cancelada'}
                  </span>
                </td>
                <td>
                  {reservation.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      onClick={() => onCancel(reservation.id)}
                      disabled={cancellingId === reservation.id}
                    >
                      {cancellingId === reservation.id ? 'Cancelando…' : 'Cancelar'}
                    </button>
                  ) : (
                    <span className="hint">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
