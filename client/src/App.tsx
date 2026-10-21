import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  cancelReservation,
  checkAvailability,
  createReservation,
  listEquipment,
  listReservations,
} from './api';
import { AvailabilityPanel } from './components/AvailabilityPanel';
import { EquipmentList } from './components/EquipmentList';
import { ReservationForm } from './components/ReservationForm';
import { ReservationTable } from './components/ReservationTable';
import { addHoursToLocalDateTime, localDateTimeToUtcIso, nowLocalDateTime } from './lib/datetime';
import type { Availability, Equipment, IntervalField, Reservation } from './types';

function describeError(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.code}: ${error.message}`;
  }
  return 'Ocurrió un error inesperado al llamar a la API.';
}

export function App() {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [selectedEquipmentId, setSelectedEquipmentId] = useState('');
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [requester, setRequester] = useState('');
  const [timeRange, setTimeRange] = useState<{ start: string; end: string }>(() => {
    const start = nowLocalDateTime();
    return { start, end: addHoursToLocalDateTime(start, 1) };
  });

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [loadingEquipment, setLoadingEquipment] = useState(true);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const list = await listEquipment();
        if (active) {
          setEquipment(list);
        }
      } catch (error) {
        if (active) {
          setErrorMessage(describeError(error));
        }
      } finally {
        if (active) {
          setLoadingEquipment(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadReservations = useCallback(async (equipmentId: string): Promise<void> => {
    setLoadingReservations(true);
    try {
      const list = await listReservations(equipmentId === '' ? undefined : equipmentId);
      setReservations(list);
    } catch (error) {
      setErrorMessage(describeError(error));
    } finally {
      setLoadingReservations(false);
    }
  }, []);

  useEffect(() => {
    void loadReservations(selectedEquipmentId);
  }, [loadReservations, selectedEquipmentId]);

  const handleSelectEquipment = useCallback((equipmentId: string) => {
    setSelectedEquipmentId(equipmentId);
    setAvailability(null);
    setNoticeMessage(null);
  }, []);

  const handleIntervalChange = useCallback((field: IntervalField, value: string) => {
    setTimeRange((current) => ({ ...current, [field]: value }));
    setAvailability(null);
  }, []);

  const handleQueryAvailability = useCallback(async (): Promise<void> => {
    if (selectedEquipmentId === '') {
      return;
    }
    const start = localDateTimeToUtcIso(timeRange.start);
    const end = localDateTimeToUtcIso(timeRange.end);
    if (start === null || end === null) {
      setErrorMessage('Ingresá una fecha y hora válidas.');
      return;
    }
    setCheckingAvailability(true);
    try {
      const result = await checkAvailability(selectedEquipmentId, start, end);
      setAvailability(result);
      setErrorMessage(null);
    } catch (error) {
      setAvailability(null);
      setErrorMessage(describeError(error));
    } finally {
      setCheckingAvailability(false);
    }
  }, [selectedEquipmentId, timeRange]);

  const handleCreateReservation = useCallback(async (): Promise<void> => {
    if (selectedEquipmentId === '') {
      return;
    }
    const start = localDateTimeToUtcIso(timeRange.start);
    const end = localDateTimeToUtcIso(timeRange.end);
    if (start === null || end === null) {
      setErrorMessage('Ingresá una fecha y hora válidas.');
      return;
    }
    setSubmitting(true);
    try {
      const created = await createReservation({
        equipmentId: selectedEquipmentId,
        requester,
        startAt: start,
        endAt: end,
      });
      setNoticeMessage(`Reserva creada con el identificador ${created.id}.`);
      setRequester('');
      setErrorMessage(null);
      await loadReservations(selectedEquipmentId);
    } catch (error) {
      setErrorMessage(describeError(error));
    } finally {
      setSubmitting(false);
    }
  }, [loadReservations, requester, selectedEquipmentId, timeRange]);

  const handleCancelReservation = useCallback(
    async (reservationId: string): Promise<void> => {
      setCancellingId(reservationId);
      try {
        await cancelReservation(reservationId);
        setNoticeMessage('Reserva cancelada.');
        setErrorMessage(null);
      } catch (error) {
        setErrorMessage(describeError(error));
      } finally {
        setCancellingId(null);
        await loadReservations(selectedEquipmentId);
      }
    },
    [loadReservations, selectedEquipmentId],
  );

  const selectedEquipment = equipment.find((item) => item.id === selectedEquipmentId);
  const equipmentNameById = useMemo(
    () => new Map(equipment.map((item) => [item.id, item.name] as const)),
    [equipment],
  );
  const reservationsById = useMemo(
    () => new Map(reservations.map((reservation) => [reservation.id, reservation] as const)),
    [reservations],
  );

  return (
    <div className="app">
      <header>
        <h1>Reservas de equipos de laboratorio</h1>
        <p className="hint">
          Las horas se capturan y se muestran en America/Argentina/Buenos_Aires (UTC-3) y se envían a la API en
          UTC.
        </p>
      </header>

      {errorMessage !== null && (
        <div className="banner banner-error" role="alert">
          {errorMessage}
        </div>
      )}
      {noticeMessage !== null && (
        <div className="banner banner-ok" role="status">
          {noticeMessage}
        </div>
      )}

      <div className="columns">
        <section className="panel">
          <h2>Equipos</h2>
          <EquipmentList
            equipment={equipment}
            selectedEquipmentId={selectedEquipmentId}
            onSelect={handleSelectEquipment}
            loading={loadingEquipment}
          />
        </section>

        <AvailabilityPanel
          equipmentId={selectedEquipmentId}
          equipmentName={selectedEquipment?.name}
          start={timeRange.start}
          end={timeRange.end}
          onChange={handleIntervalChange}
          onQuery={() => void handleQueryAvailability()}
          availability={availability}
          loading={checkingAvailability}
          reservationsById={reservationsById}
        />

        <ReservationForm
          equipmentId={selectedEquipmentId}
          equipmentName={selectedEquipment?.name}
          requester={requester}
          onRequesterChange={setRequester}
          start={timeRange.start}
          end={timeRange.end}
          onChange={handleIntervalChange}
          onSubmit={() => void handleCreateReservation()}
          submitting={submitting}
        />
      </div>

      <ReservationTable
        reservations={reservations}
        equipmentNameById={equipmentNameById}
        onCancel={(reservationId) => void handleCancelReservation(reservationId)}
        cancellingId={cancellingId}
        loading={loadingReservations}
      />
    </div>
  );
}
