import type { Db } from './database.js';
import { migrations } from './migrations/index.js';

export function migrate(db: Db): string[] {
  db.exec('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TEXT NOT NULL)');

  const rows = db.prepare('SELECT id FROM schema_migrations').all() as Array<{ id: string }>;
  const applied = new Set(rows.map((row) => row.id));

  const insert = db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)');
  const apply = db.transaction((migrationId: string, sql: string) => {
    db.exec(sql);
    insert.run(migrationId, new Date().toISOString());
  });

  const executed: string[] = [];
  for (const migration of migrations) {
    if (applied.has(migration.id)) {
      continue;
    }
    apply(migration.id, migration.up);
    executed.push(migration.id);
  }
  return executed;
}
