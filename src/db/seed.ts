import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config/index.js';
import { openDatabase, type Db } from './database.js';
import { migrate } from './migrator.js';

export interface InventoryItem {
  id: string;
  name: string;
}

function isInventoryItem(value: unknown): value is InventoryItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return typeof record['id'] === 'string' && typeof record['name'] === 'string';
}

export function readInventory(file: string): InventoryItem[] {
  const raw = readFileSync(file, 'utf8');
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`El archivo de inventario "${file}" debe contener un arreglo.`);
  }
  const entries = parsed as unknown[];
  return entries.map((entry, index) => {
    if (!isInventoryItem(entry)) {
      throw new Error(`El elemento ${index} del inventario no tiene la forma { "id": string, "name": string }.`);
    }
    return entry;
  });
}

export function seedInventory(db: Db, items: InventoryItem[]): number {
  const upsert = db.prepare(
    'INSERT INTO equipment (id, name) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET name = excluded.name',
  );
  const insertAll = db.transaction((list: InventoryItem[]) => {
    for (const item of list) {
      upsert.run(item.id, item.name);
    }
  });
  insertAll(items);
  return items.length;
}

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const config = loadConfig();
  const db = openDatabase(config.databaseFile);
  try {
    migrate(db);
    const items = readInventory(config.inventoryFile);
    const total = seedInventory(db, items);
    console.log(`Inventario cargado: ${total} unidades en ${config.databaseFile}`);
  } finally {
    db.close();
  }
}
