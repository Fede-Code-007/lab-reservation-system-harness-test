import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

export interface AppConfig {
  host: string;
  port: number;
  databaseFile: string;
  testDatabaseFile: string;
  inventoryFile: string;
  logLevel: string;
}

function resolveFromProjectRoot(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return 3000;
  }
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT inválido: "${value}". Debe ser un entero entre 1 y 65535.`);
  }
  return port;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    host: env.HOST ?? '127.0.0.1',
    port: parsePort(env.PORT),
    databaseFile: resolveFromProjectRoot(env.DB_PATH ?? 'data/reservas.db'),
    testDatabaseFile: resolveFromProjectRoot(env.TEST_DATABASE_PATH ?? 'data/test.db'),
    inventoryFile: resolveFromProjectRoot(env.INVENTORY_FILE ?? 'data/inventory.json'),
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}
