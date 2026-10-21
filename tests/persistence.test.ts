import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config/index.js';
import { openDatabase, type Db } from '../src/db/database.js';
import { migrate } from '../src/db/migrator.js';
import { assertSeparateDatabases, DatabaseResetError, resetTestDatabase } from '../src/db/reset.js';
import { readInventory, seedInventory } from '../src/db/seed.js';

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

  it.todo('CA-07: las reservas activas y canceladas sobreviven al reinicio del servidor');
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
