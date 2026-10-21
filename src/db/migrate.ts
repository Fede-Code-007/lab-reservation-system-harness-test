import { pathToFileURL } from 'node:url';
import { loadConfig } from '../config/index.js';
import { openDatabase } from './database.js';
import { migrate } from './migrator.js';

const isMainModule = process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const config = loadConfig();
  const db = openDatabase(config.databaseFile);
  try {
    const executed = migrate(db);
    if (executed.length === 0) {
      console.log(`La base de datos ${config.databaseFile} ya estaba actualizada.`);
    } else {
      console.log(`Migraciones aplicadas en ${config.databaseFile}: ${executed.join(', ')}`);
    }
  } finally {
    db.close();
  }
}
