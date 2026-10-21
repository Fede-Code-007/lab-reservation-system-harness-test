import { rmSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, type AppConfig } from '../config/index.js';
import { openDatabase } from './database.js';
import { migrate } from './migrator.js';
import { readInventory, seedInventory } from './seed.js';

export class DatabaseResetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DatabaseResetError';
  }
}

function normalizePath(file: string): string {
  const resolved = path.resolve(file);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

export function assertSeparateDatabases(testDatabaseFile: string, databaseFile: string): void {
  if (normalizePath(testDatabaseFile) === normalizePath(databaseFile)) {
    throw new DatabaseResetError(
      `db:reset no puede reiniciar la base de datos de desarrollo (${databaseFile}). ` +
        'Configurá DB_PATH y TEST_DATABASE_PATH con rutas distintas.',
    );
  }
}

export function resetTestDatabase(config: AppConfig): string {
  const target = path.resolve(config.testDatabaseFile);
  const development = path.resolve(config.databaseFile);

  assertSeparateDatabases(target, development);

  console.warn(`Advertencia: se van a eliminar las reservas de la base de datos de prueba: ${target}`);

  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(`${target}${suffix}`, { force: true });
  }

  const db = openDatabase(target);
  try {
    migrate(db);
    seedInventory(db, readInventory(config.inventoryFile));
  } finally {
    db.close();
  }

  return target;
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  try {
    const target = resetTestDatabase(loadConfig());
    console.log(`Base de datos de prueba reiniciada: ${target}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
