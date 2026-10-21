import { buildApp } from '../../src/app.js';
import { loadConfig } from '../../src/config/index.js';
import { openDatabase, type Db } from '../../src/db/database.js';
import { migrate } from '../../src/db/migrator.js';
import { readInventory, seedInventory } from '../../src/db/seed.js';

export interface TestContext {
  app: ReturnType<typeof buildApp>;
  db: Db;
  close(): Promise<void>;
}

export function createTestDatabase(): Db {
  const db = openDatabase(':memory:');
  migrate(db);
  seedInventory(db, readInventory(loadConfig().inventoryFile));
  return db;
}

export async function createTestContext(): Promise<TestContext> {
  const db = createTestDatabase();
  const app = buildApp({ db });
  await app.ready();

  return {
    app,
    db,
    close: async () => {
      await app.close();
      db.close();
    },
  };
}
