import { buildApp } from './app.js';
import { loadConfig } from './config/index.js';
import { openDatabase } from './db/database.js';
import { migrate } from './db/migrator.js';
import { readInventory, seedInventory } from './db/seed.js';

const config = loadConfig();
const db = openDatabase(config.databaseFile);
migrate(db);
seedInventory(db, readInventory(config.inventoryFile));

const app = buildApp({ db, logger: true, logLevel: config.logLevel });

async function shutdown(signal: string): Promise<void> {
  app.log.info(`Se recibió la señal ${signal}. Cerrando el servidor.`);
  await app.close();
  db.close();
}

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

app
  .listen({ host: config.host, port: config.port })
  .then((address) => {
    app.log.info(`Servidor escuchando en ${address}`);
  })
  .catch((error: unknown) => {
    app.log.error({ err: error }, 'No se pudo iniciar el servidor');
    process.exit(1);
  });
