import BetterSqlite3 from 'better-sqlite3';

export type Db = BetterSqlite3.Database;

export function openDatabase(file: string): Db {
  const db = new BetterSqlite3(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
