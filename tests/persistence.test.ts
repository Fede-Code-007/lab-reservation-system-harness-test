import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/index.js';
import { openDatabase, type Db } from '../src/db/database.js';
import { migrate } from '../src/db/migrator.js';
import { assertSeparateDatabases, DatabaseResetError, resetTestDatabase } from '../src/db/reset.js';
import { readInventory, seedInventory } from '../src/db/seed.js';
import {
  availabilityUrl,
  cancelReservation,
  createReservation,
  postReservation,
  type ReservationResponse,
} from './helpers/reservations.js';
import { createTestContextWithDb } from './helpers/test-app.js';

function tableNames(db: Db): string[] {
  const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as Array<{ name: string }>;
  return rows.map((row) => row.name);
}

function equipmentRows(db: Db): Array<{ id: string; name: string }> {
  return db.prepare('SELECT id, name FROM equipment ORDER BY id').all() as Array<{ id: string; name: string }>;
}

describe('Migraciones', () => {
  it('crea las tablas equipment y reservations', () => {
    const db = openDatabase(':memory:');
    try {
      migrate(db);

      const names = tableNames(db);
      expect(names).toContain('equipment');
      expect(names).toContain('reservations');
    } finally {
      db.close();
    }
  });

  it('es idempotente: aplicarlas dos veces no vuelve a ejecutar nada', () => {
    const db = openDatabase(':memory:');
    try {
      expect(migrate(db)).toHaveLength(1);
      expect(migrate(db)).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('mantiene habilitadas las claves foráneas', () => {
    const db = openDatabase(':memory:');
    try {
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    } finally {
      db.close();
    }
  });
});

describe('Carga del inventario', () => {
  it('no duplica unidades al ejecutarse dos veces', () => {
    const db = openDatabase(':memory:');
    try {
      migrate(db);
      const items = readInventory(loadConfig().inventoryFile);

      seedInventory(db, items);
      seedInventory(db, items);

      const rows = equipmentRows(db);
      expect(rows).toHaveLength(items.length);
      expect(rows.map((row) => row.id)).toEqual(['FUE-01', 'MIC-01', 'MIC-02', 'MUL-01', 'OSC-01']);
    } finally {
      db.close();
    }
  });

  it('no borra las reservas al ejecutarse dos veces', () => {
    const db = openDatabase(':memory:');
    try {
      migrate(db);
      const items = readInventory(loadConfig().inventoryFile);
      seedInventory(db, items);

      db.prepare(
        `INSERT INTO reservations
           (id, equipment_id, requester, start_at, end_at, status, created_at, cancelled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'res-ficticia',
        'MIC-01',
        'Ana Ficticia',
        '2026-11-02T13:00:00.000Z',
        '2026-11-02T14:00:00.000Z',
        'ACTIVE',
        '2026-10-20T12:00:00.000Z',
        null,
      );

      seedInventory(db, items);
      seedInventory(db, items);

      const equipment = db.prepare('SELECT count(*) AS c FROM equipment').get() as { c: number };
      const reservations = db.prepare('SELECT id, status, cancelled_at FROM reservations').all() as Array<{
        id: string;
        status: string;
        cancelled_at: string | null;
      }>;

      expect(equipment.c).toBe(items.length);
      expect(reservations).toEqual([{ id: 'res-ficticia', status: 'ACTIVE', cancelled_at: null }]);
    } finally {
      db.close();
    }
  });

  it('rechaza una reserva con una unidad inexistente (clave foránea activa)', () => {
    const db = openDatabase(':memory:');
    try {
      migrate(db);

      expect(() =>
        db
          .prepare(
            `INSERT INTO reservations
               (id, equipment_id, requester, start_at, end_at, status, created_at, cancelled_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            'res-sin-equipo',
            'NO-EXISTE',
            'Ana Ficticia',
            '2026-11-02T13:00:00.000Z',
            '2026-11-02T14:00:00.000Z',
            'ACTIVE',
            '2026-10-20T12:00:00.000Z',
            null,
          ),
      ).toThrow();
    } finally {
      db.close();
    }
  });

  it('rechaza un estado de reserva distinto de ACTIVE o CANCELLED', () => {
    const db = openDatabase(':memory:');
    try {
      migrate(db);
      seedInventory(db, readInventory(loadConfig().inventoryFile));

      expect(() =>
        db
          .prepare(
            `INSERT INTO reservations
               (id, equipment_id, requester, start_at, end_at, status, created_at, cancelled_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            'res-estado-invalido',
            'MIC-01',
            'Ana Ficticia',
            '2026-11-02T13:00:00.000Z',
            '2026-11-02T14:00:00.000Z',
            'PENDIENTE',
            '2026-10-20T12:00:00.000Z',
            null,
          ),
      ).toThrow();
    } finally {
      db.close();
    }
  });

  it('admite una reserva cancelada con cancelled_at informado', () => {
    const db = openDatabase(':memory:');
    try {
      migrate(db);
      seedInventory(db, readInventory(loadConfig().inventoryFile));

      db.prepare(
        `INSERT INTO reservations
           (id, equipment_id, requester, start_at, end_at, status, created_at, cancelled_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        'res-cancelada',
        'MIC-01',
        'Ana Ficticia',
        '2026-11-02T13:00:00.000Z',
        '2026-11-02T14:00:00.000Z',
        'CANCELLED',
        '2026-10-20T12:00:00.000Z',
        '2026-10-21T09:30:00.000Z',
      );

      const row = db.prepare('SELECT status, cancelled_at FROM reservations WHERE id = ?').get('res-cancelada') as {
        status: string;
        cancelled_at: string | null;
      };

      expect(row).toEqual({ status: 'CANCELLED', cancelled_at: '2026-10-21T09:30:00.000Z' });
    } finally {
      db.close();
    }
  });
});

describe('Persistencia en un archivo de base de datos (CA-07, RF-05)', () => {
  const ACTIVE_RESERVATION = {
    equipmentId: 'MIC-01',
    requester: 'Ana Ficticia',
    startAt: '2026-11-02T10:00:00-03:00',
    endAt: '2026-11-02T11:00:00-03:00',
  };

  const CANCELLED_RESERVATION = {
    equipmentId: 'MIC-01',
    requester: 'Bruno Ficticio',
    startAt: '2026-11-02T12:00:00-03:00',
    endAt: '2026-11-02T13:00:00-03:00',
  };

  /** Abre la base en archivo, aplica las migraciones y carga el inventario. */
  function openFileDatabase(file: string): Db {
    const db = openDatabase(file);
    migrate(db);
    seedInventory(db, readInventory(loadConfig().inventoryFile));
    return db;
  }

  it('CA-07: tras cerrar y reabrir la app, la activa sigue bloqueando su intervalo y la cancelada conserva su estado sin bloquear', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'lab-persistence-'));
    const databaseFile = path.join(directory, 'reservas.db');

    try {
      // Primera apertura: se crea una reserva activa y se cancela otra.
      const first = await createTestContextWithDb(openFileDatabase(databaseFile));
      let activeId: string;
      let activeCreatedAt: string;
      let cancelledId: string;
      let cancelledCreatedAt: string;
      let cancelledAt: string | null;
      try {
        const active = await createReservation(first, ACTIVE_RESERVATION);
        activeId = active.id;
        activeCreatedAt = active.createdAt;

        const toCancel = await createReservation(first, CANCELLED_RESERVATION);
        cancelledId = toCancel.id;
        cancelledCreatedAt = toCancel.createdAt;

        const cancelResponse = await cancelReservation(first, toCancel.id);
        expect(cancelResponse.statusCode).toBe(200);
        const cancelled = cancelResponse.json() as ReservationResponse;
        expect(cancelled.status).toBe('CANCELLED');
        expect(cancelled.cancelledAt).not.toBeNull();
        cancelledAt = cancelled.cancelledAt;
      } finally {
        // Cierra la aplicacion y la conexion a la base de datos.
        await first.close();
      }

      // Segunda apertura: la misma base en archivo.
      const second = await createTestContextWithDb(openFileDatabase(databaseFile));
      try {
        const listResponse = await second.app.inject({
          method: 'GET',
          url: '/reservations?equipmentId=MIC-01',
        });
        expect(listResponse.statusCode).toBe(200);
        const persisted = listResponse.json() as ReservationResponse[];
        expect(persisted).toHaveLength(2);

        // La reserva activa conserva sus datos y sigue ACTIVE.
        const active = persisted.find((reservation) => reservation.id === activeId);
        expect(active).toEqual({
          id: activeId,
          equipmentId: 'MIC-01',
          requester: 'Ana Ficticia',
          startAt: '2026-11-02T13:00:00.000Z',
          endAt: '2026-11-02T14:00:00.000Z',
          status: 'ACTIVE',
          createdAt: activeCreatedAt,
          cancelledAt: null,
        });

        // La reserva cancelada conserva su estado y su marca de cancelacion.
        const cancelled = persisted.find((reservation) => reservation.id === cancelledId);
        expect(cancelled).toEqual({
          id: cancelledId,
          equipmentId: 'MIC-01',
          requester: 'Bruno Ficticio',
          startAt: '2026-11-02T15:00:00.000Z',
          endAt: '2026-11-02T16:00:00.000Z',
          status: 'CANCELLED',
          createdAt: cancelledCreatedAt,
          cancelledAt,
        });

        // La reserva activa sigue bloqueando su intervalo.
        const activeAvailability = await second.app.inject({
          method: 'GET',
          url: availabilityUrl(ACTIVE_RESERVATION.startAt, ACTIVE_RESERVATION.endAt),
        });
        expect(activeAvailability.statusCode).toBe(200);
        expect(activeAvailability.json()).toEqual({
          equipmentId: 'MIC-01',
          start: '2026-11-02T13:00:00.000Z',
          end: '2026-11-02T14:00:00.000Z',
          available: false,
          conflicts: [activeId],
        });

        const overlap = await postReservation(second, {
          ...ACTIVE_RESERVATION,
          requester: 'Carla Ficticia',
        });
        expect(overlap.statusCode).toBe(409);
        expect(overlap.json()).toMatchObject({ error: { code: 'OVERLAP' } });

        // La reserva cancelada no bloquea su intervalo.
        const cancelledAvailability = await second.app.inject({
          method: 'GET',
          url: availabilityUrl(CANCELLED_RESERVATION.startAt, CANCELLED_RESERVATION.endAt),
        });
        expect(cancelledAvailability.statusCode).toBe(200);
        expect(cancelledAvailability.json()).toEqual({
          equipmentId: 'MIC-01',
          start: '2026-11-02T15:00:00.000Z',
          end: '2026-11-02T16:00:00.000Z',
          available: true,
          conflicts: [],
        });

        // La fila cancelada sigue en la base: no se elimino fisicamente.
        const cancelledRow = second.db
          .prepare('SELECT id, status, cancelled_at FROM reservations WHERE id = ?')
          .get(cancelledId) as { id: string; status: string; cancelled_at: string | null };
        expect(cancelledRow).toEqual({
          id: cancelledId,
          status: 'CANCELLED',
          cancelled_at: cancelledAt,
        });

        // El intervalo liberado por la cancelacion admite una nueva reserva.
        const reused = await postReservation(second, {
          ...CANCELLED_RESERVATION,
          requester: 'Diego Ficticio',
        });
        expect(reused.statusCode).toBe(201);
      } finally {
        await second.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('RF-01: reinicializar la base en archivo no duplica el inventario ni borra las reservas', async () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'lab-persistence-'));
    const databaseFile = path.join(directory, 'reservas.db');

    try {
      const first = await createTestContextWithDb(openFileDatabase(databaseFile));
      let reservationId: string;
      try {
        const active = await createReservation(first, ACTIVE_RESERVATION);
        reservationId = active.id;
      } finally {
        await first.close();
      }

      // Se vuelve a inicializar la base (migraciones + carga del inventario).
      const second = await createTestContextWithDb(openFileDatabase(databaseFile));
      try {
        const equipment = second.db.prepare('SELECT id FROM equipment ORDER BY id').all() as Array<{
          id: string;
        }>;
        const reservations = second.db
          .prepare('SELECT id, status FROM reservations')
          .all() as Array<{ id: string; status: string }>;

        expect(equipment).toHaveLength(5);
        expect(equipment.map((row) => row.id)).toEqual([
          'FUE-01',
          'MIC-01',
          'MIC-02',
          'MUL-01',
          'OSC-01',
        ]);
        expect(reservations).toEqual([{ id: reservationId, status: 'ACTIVE' }]);
      } finally {
        await second.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});

describe('Reinicio de la base de datos de pruebas (db:reset)', () => {
  it('impide reiniciar la base de datos de desarrollo', () => {
    const development = path.join(process.cwd(), 'data', 'reservas.db');

    expect(() => assertSeparateDatabases(development, development)).toThrow(DatabaseResetError);
  });

  it('detecta la misma base con distinta capitalización en Windows', () => {
    const development = path.join(process.cwd(), 'data', 'reservas.db');
    const testDatabase = path.join(process.cwd(), 'data', 'RESERVAS.DB');

    if (process.platform === 'win32') {
      expect(() => assertSeparateDatabases(testDatabase, development)).toThrow(DatabaseResetError);
    } else {
      expect(() => assertSeparateDatabases(testDatabase, development)).not.toThrow();
    }
  });

  it('permite reiniciar una base de datos de pruebas distinta', () => {
    const development = path.join(process.cwd(), 'data', 'reservas.db');
    const testDatabase = path.join(process.cwd(), 'data', 'test.db');

    expect(() => assertSeparateDatabases(testDatabase, development)).not.toThrow();
  });

  it('recrea la base de datos de pruebas con el esquema y el inventario, sin datos previos', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'lab-reset-'));
    const testDatabase = path.join(directory, 'test.db');

    try {
      const previous = openDatabase(testDatabase);
      previous.exec('CREATE TABLE basura (id TEXT)');
      previous.close();

      const target = resetTestDatabase(loadConfig({ TEST_DATABASE_PATH: testDatabase }));

      expect(target).toBe(testDatabase);
      const reopened = openDatabase(testDatabase);
      try {
        const names = tableNames(reopened);
        expect(names).toContain('equipment');
        expect(names).toContain('reservations');
        expect(names).not.toContain('basura');
        expect(equipmentRows(reopened)).toHaveLength(5);
      } finally {
        reopened.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('no borra la base de datos de desarrollo cuando el destino coincide con ella', () => {
    const directory = mkdtempSync(path.join(tmpdir(), 'lab-reset-'));
    const database = path.join(directory, 'reservas.db');

    try {
      const db = openDatabase(database);
      migrate(db);
      db.close();

      const config = loadConfig({ DB_PATH: database, TEST_DATABASE_PATH: database });
      expect(() => resetTestDatabase(config)).toThrow(DatabaseResetError);

      const untouched = openDatabase(database);
      try {
        expect(tableNames(untouched)).toContain('reservations');
      } finally {
        untouched.close();
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
