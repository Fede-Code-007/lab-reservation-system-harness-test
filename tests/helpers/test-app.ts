import { buildApp } from '../../src/app.js';
import { openDatabase, type Db } from '../../src/db/database.js';
import { migrate } from '../../src/db/migrator.js';

export interface TestContext {
  app: ReturnType<typeof buildApp>;
  db: Db;
  close(): Promise<void>;
}

export async function createTestContext(): Promise<TestContext> {
  const db = openDatabase(':memory:');
  migrate(db);
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
