import type { IntervalField } from '../types';

interface ReservationFormProps {
  equipmentId: string;
  equipmentName: string | undefined;
  requester: string;
  onRequesterChange: (value: string) => void;
  start: string;
  end: string;
  onChange: (field: IntervalField, value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}

export function ReservationForm({
  equipmentId,
  equipmentName,
  requester,
  onRequesterChange,
  start,
  end,
  onChange,
  onSubmit,
  submitting,
}: ReservationFormProps) {
  if (equipmentId === '') {
    return (
      <section className="panel">
        <h2>Nueva reserva</h2>
        <p className="hint">Seleccioná un equipo para crear una reserva.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>Nueva reserva</h2>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <p className="selected-unit">
          Equipo: <strong>{equipmentId}</strong>
          {equipmentName === undefined ? '' : ` — ${equipmentName}`}
        </p>
        <div className="fields">
          <label>
            Solicitante
            <input
              type="text"
              value={requester}
              onChange={(event) => onRequesterChange(event.target.value)}
              required
            />
          </label>
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
        <button type="submit" disabled={submitting}>
          {submitting ? 'Creando…' : 'Crear reserva'}
        </button>
      </form>
    </section>
  );
}
