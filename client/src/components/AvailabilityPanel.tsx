import { formatUtcForDisplay } from '../lib/datetime';
import type { Availability, IntervalField, Reservation } from '../types';

interface AvailabilityPanelProps {
  equipmentId: string;
  equipmentName: string | undefined;
  start: string;
  end: string;
  onChange: (field: IntervalField, value: string) => void;
  onQuery: () => void;
  availability: Availability | null;
  loading: boolean;
  reservationsById: Map<string, Reservation>;
}

export function AvailabilityPanel({
  equipmentId,
  equipmentName,
  start,
  end,
  onChange,
  onQuery,
  availability,
  loading,
  reservationsById,
}: AvailabilityPanelProps) {
  return (
    <section className="panel">
      <h2>Disponibilidad</h2>
      {equipmentId === '' ? (
        <p className="hint">Seleccioná un equipo para consultar su disponibilidad.</p>
      ) : (
        <form
          className="form"
          onSubmit={(event) => {
            event.preventDefault();
            onQuery();
          }}
        >
          <p className="selected-unit">
            Equipo: <strong>{equipmentId}</strong>
            {equipmentName === undefined ? '' : ` — ${equipmentName}`}
          </p>
          <div className="fields">
            <label>
              Inicio (America/Argentina/Buenos_Aires)
              <input
                type="datetime-local"
                value={start}
                onChange={(event) => onChange('start', event.target.value)}
                required
              />
            </label>
            <label>
              Fin (America/Argentina/Buenos_Aires)
              <input
                type="datetime-local"
                value={end}
                onChange={(event) => onChange('end', event.target.value)}
                required
              />
            </label>
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Consultando…' : 'Consultar disponibilidad'}
          </button>
        </form>
      )}

      {availability !== null && (
        <div className={availability.available ? 'result result-ok' : 'result result-error'}>
          <p>
            <strong>{availability.available ? 'Disponible' : 'No disponible'}</strong> para el intervalo{' '}
            {formatUtcForDisplay(availability.start)} – {formatUtcForDisplay(availability.end)}.
          </p>
          {availability.conflicts.length > 0 && (
            <ul>
              {availability.conflicts.map((conflictId) => {
                const conflict = reservationsById.get(conflictId);
                return (
                  <li key={conflictId}>
                    {conflict === undefined ? (
                      <span>Reserva en conflicto: {conflictId}</span>
                    ) : (
                      <span>
                        Conflicto con la reserva de {conflict.requester} (
                        {formatUtcForDisplay(conflict.startAt)} – {formatUtcForDisplay(conflict.endAt)})
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
