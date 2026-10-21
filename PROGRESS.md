# Progreso y decisiones

## Estado
- [x] 1 Andamiaje - Completada
- [ ] 2 Base de datos
- [ ] 3 Reglas de reservas
- [ ] 4 API
- [ ] 5 Persistencia
- [ ] 6 React
- [ ] 7 Verificación y README

## Decisiones
| Fecha | Decisión | Motivo | Alternativas | Consecuencia |
|---|---|---|---|---|
| 2026-10-20 | Centralizar las instrucciones del agente en `AGENTS.md` para OpenCode | Establecer restricciones y criterios de implementación persistentes, independientes del chat | - | Las instrucciones del proyecto quedan documentadas en un archivo accesible para el agente |
| 2026-10-20 | Ejecutar una prueba de comprensión en modo de solo lectura | Comprobar que el agente interpreta la especificación y resume las reglas principales sin modificar archivos | Omitir la prueba inicial o comenzar directamente con la implementación | Se obtiene una respuesta documentable sobre el stack, los intervalos consecutivos, la cancelación y la política de fechas |
| 2026-10-20 | Separar el andamiaje del backend de la lógica de negocio | Preparar la estructura antes de implementar funcionalidades | Implementación simultánea | Estructura inicial generada; funcionalidades pendientes |
| 2026-10-20 | Utilizar módulos separados para base de datos y equipment | Separar persistencia, acceso a datos y rutas HTTP | Implementación en un único módulo | Se crean `src/db` y `src/modules/equipment` |
| 2026-10-20 | Configurar la ruta de SQLite mediante `DB_PATH`, con valor predeterminado `data/reservas.db` | Permitir configurar la base de datos por entorno | `DATABASE_PATH` y `data/lab.db` | `db:migrate` y `db:seed` utilizan la configuración de `DB_PATH` |
| 2026-10-20 | Limitar `db:reset` a la base de datos de pruebas | Evitar borrar accidentalmente las reservas de desarrollo | Reiniciar una única base de datos compartida | Se utiliza `TEST_DATABASE_PATH` y se emite una advertencia sobre el borrado de reservas |
| 2026-10-20 | Proyecto ESM con `"type": "module"` y `module`/`moduleResolution` `NodeNext` | `typebox` v1 (dependencia de `@fastify/type-provider-typebox` v6) se publica solo en ESM y las importaciones relativas deben llevar extensión `.js` para que `node dist/server.js` funcione | CommonJS con `module: CommonJS` | Los imports relativos usan extensión `.js`; Vitest resuelve la equivalencia con los archivos `.ts` |
| 2026-10-21 | TypeScript 6.0.3 | Es la versión con la que `@fastify/type-provider-typebox@6.3.0` valida sus propios tipos (`devDependency: typescript ~6.0.2`); es GA estable, conserva `tsserver` para la integración con el editor y se distribuye como un único paquete npm | `typescript@7.0.2` (puerto nativo en Go: sin `tsserver` y con binarios por plataforma; la línea 7.x sigue en movimiento con 7.1 en beta) o `typescript@5.9.3` (anterior en dos versiones al toolchain actual del type provider) | Verificado empíricamente: 5.9.3, 6.0.3 y 7.0.2 dan 0 errores sobre el proyecto y diagnósticos idénticos sobre un archivo sonda; se adoptó 6.0.3 |
| 2026-10-21 | `typebox@^1` como peer de `@fastify/type-provider-typebox@^6` y `ajv-formats@^3` declarado explícitamente | La v6 del type provider exige `typebox` y `ajv-formats` como peer dependencies. La documentación oficial de Fastify (`fastify.dev/docs/latest/Reference/Type-Providers/`, `latest` = v5.12.7) lista `typebox` → `sinclairzx81/typebox` como paquete soportado y muestra el mismo patrón de tipos usado en `src/types.ts` | `@sinclair/typebox` (peer de la v5 del type provider, publicada por última vez el 2025-07-14) | El type provider quedó fijo en la serie v6; no se pueden mezclar `@sinclair/typebox` con la v6. `ajv-formats` se declara solo para satisfacer el peer: con `TypeBoxValidatorCompiler` no se usa el validador AJV por defecto |
| 2026-10-21 | La ruta de SQLite se configura con `DB_PATH` (predeterminado `data/reservas.db`) y `TEST_DATABASE_PATH` (predeterminado `data/test.db`) | Resuelve la contradicción entre las decisiones del 2026-10-20 y el código, que usaba `DB_FILE`/`data/lab.db`. Es la decisión ya registrada en el proyecto, y `SPEC.md` §12 solo exige «reiniciar el entorno de prueba sin afectar los datos de desarrollo», sin fijar nombres | `DB_FILE`/`data/lab.db` (implementación anterior, con `data/lab.db` figura en las alternativas descartadas de la decisión del 2026-10-20) | Sustituye la fila del 2026-10-21 sobre `DB_FILE`. `src/config/index.ts` lee `DB_PATH` y `TEST_DATABASE_PATH`; `data/lab.db` se eliminó (5 unidades, 0 reservas) y `data/reservas.db` es la base de desarrollo |
| 2026-10-21 | `db:reset` avisa antes de borrar y aborta si el destino es la base de datos de desarrollo | `SPEC.md` §12 exige no afectar los datos de desarrollo y `AGENTS.md` prohíbe borrar datos persistidos | Reinicio silencioso (comportamiento anterior) | `src/db/reset.ts` expone `assertSeparateDatabases` (comparación de rutas absolutas, insensible a mayúsculas en Windows) y `resetTestDatabase`; el CLI emite la advertencia y sale con código 1 sin borrar si el destino coincide con `DB_PATH`. Cubierto por 5 pruebas en `tests/persistence.test.ts` |
| 2026-10-20 | `db:reset` reinicia solo la base de datos de prueba (`data/test.db`) y se niega a tocar `DB_FILE` | `SPEC.md` §12 pide «reiniciar el entorno de prueba sin afectar los datos de desarrollo» | Reiniciar la base de datos de desarrollo | El script compara rutas resueltas y aborta si coinciden. **Reemplazada** por las dos decisiones del 2026-10-21 sobre `DB_PATH`/`TEST_DATABASE_PATH` y la advertencia previa |
| 2026-10-20 | Migraciones escritas como módulos TypeScript (`src/db/migrations/*.ts`) en lugar de archivos `.sql` | Evita un paso de copia de archivos no TypeScript en `npm run build` y mantiene el proyecto sin scripts de shelldependent | Archivos `.sql` copiados al build | La estructura de `db/migrations/` se mantiene; el runner aplica cada migración dentro de una transacción y la tabla `schema_migrations` evita duplicados |
| 2026-10-21 | Las listas de endpoints (`GET /equipment`, `GET /reservations`) responden con un arreglo JSON simple | `SPEC.md` §8 (líneas 235-244) define el formato de reserva, disponibilidad y error, pero no el de las listas. El único envelope que define la especificación es el de error; los casos de éxito son payloads directos, y los arreglos ya aparecen como valores dentro de objetos (`conflicts`). `[]` no es ambiguo para la lista vacía | Envolver en `{ "equipment": [...] }` / `{ "reservations": [...] }` | Decisión ratificada por el desarrollador; ratifica lo ya implementado en `src/schemas/equipment.ts` y `src/schemas/reservations.ts` (`Type.Array`) |
| 2026-10-20 | Las rutas validan únicamente formato y presencia de campos; las reglas de negocio quedan en los servicios | `SPEC.md` §6 fija el orden de validación (400 → 404 → 409) y la separación de responsabilidades de §9 | Implementar ahora toda la lógica en las rutas | `trim` y longitud máxima de 80 del solicitante (RN-02) se aplican en el servicio, no en el esquema de transporte, para no contradecir la especificación |

## Evidencias de uso del agente
- Captura del modelo seleccionado en OpenCode: `docs/agent-evidence/Evidencia de la versión de opencode y del modelo seleccionado.png`
- Captura del primer prompt con su respuesta: `docs/agent-evidence/Captura del primer prompt.png`
- Git diff luego del primer prompt: `docs\agent-evidence\Captura de git diff luego del primer prompt.png`
- Captura del segundo prompt: `docs/agent-evidence/Captura de pantalla del segundo PROMPT.png`
- Resumen de la respuesta segundo prompt: `docs/agent-evidence/Resumen final respuesta del segundo PROMPT parte 1.png`
- Continuación del resumen: `docs/agent-evidence/Resumen final respuesta del segundo PROMPT parte 2.png`
- Git diff luego del segundo prompt: `docs/agent-evidence/Git diff luego del segundo PROMPT.png`
- Comprobaciones manuales: `docs/agent-evidence/Comprobaciones manuales segundo PROMPT.png` 

## Verificaciones ejecutadas por mí
| Comando o verificación | Versión | Resultado real |
|---|---|---|
| Selección del modelo en OpenCode | OpenCode 1.19.3; MiniMax M3.1 Flash (free) | Modelo seleccionado correctamente |
| Configuración de permisos | OpenCode 1.19.3 | Modo lectura configurado correctamente|
| Prueba: lectura de `SPEC.md` y reglas del proyecto | OpenCode 1.19.3; MiniMax M3.1 Flash (free) | Ejecutada; respuesta obtenida: resumen de las reglas del proyecto, sin modificaciones de los archivos |
| `npm test` inicial | Vitest 5.0.5 | Sin errores reportados; 3 archivos pasados, 16 pruebas pasadas y 17 pruebas `todo` |
| `npm run typecheck` inicial | TypeScript 6.0.3 | Exit 0 |
| `npm run build` inicial | TypeScript 6.0.3 | Exit 0 |


## Tarea 1 — Andamiaje (SPEC.md §3 y §9)
**Estado:** implementada. Las dependencias se instalaron y el agente ejecutó las verificaciones con los resultados reales registrados abajo; la validación final quedo a cargo del desarrollador.

**Archivos creados**
- `package.json` — scripts `dev`, `build`, `start`, `test`, `test:watch`, `typecheck`, `db:migrate`, `db:seed`, `db:reset`.
- `package-lock.json` — versiones exactas resueltas por npm.
- `tsconfig.json` (strict) y `tsconfig.build.json` (emisión a `dist/`).
- `vitest.config.ts` — entorno `node`, incluye `tests/**/*.test.ts`.
- `src/app.ts`, `src/server.ts`, `src/types.ts` (alias `TypeboxApp`).
- `src/config/index.ts` — `HOST`, `PORT`, `DB_PATH`, `TEST_DATABASE_PATH`, `INVENTORY_FILE`, `LOG_LEVEL`.
- `src/errors/index.ts` — `AppError` y subtipos (`VALIDATION_ERROR`, `NOT_FOUND`, `OVERLAP`, `ALREADY_CANCELLED`, `NOT_IMPLEMENTED`, `INTERNAL_ERROR`).
- `src/db/database.ts`, `src/db/migrator.ts`, `src/db/migrate.ts`, `src/db/seed.ts`, `src/db/reset.ts`, `src/db/migrations/001_initial.ts`.
- `src/schemas/` — esquemas de transporte (TypeBox) de inventario, disponibilidad y reservas.
- `src/modules/equipment/` y `src/modules/reservations/` — `*.routes.ts`, `*.service.ts`, `*.repository.ts`.
- `tests/equipment.test.ts`, `tests/reservations.test.ts`, `tests/persistence.test.ts`, `tests/helpers/test-app.ts`.
- `.gitignore` — se agregaron `coverage/` y `client/dist/`.

**Sin lógica de negocio:** los repositorios y servicios son un andamiaje sin implementar y responden `501 NOT_IMPLEMENTED`; el `409 OVERLAP` y la transactionalidad de RN-04/RN-07 quedan para la tarea 3.

**Verificaciones ejecutadas por el agente (resultados reales)**
| Comando | Resultado real |
|---|---|
| `npm install` | `added 95 packages, and audited 96 packages in 2m`; 0 vulnerabilidades; `package-lock.json` generado |
| `npm run typecheck` | Sin errores (0 diagnósticos) |
| `npm test` | 3 archivos de prueba, 11 pruebas aprobadas, 17 `todo` pendientes, 0 fallos |
| `npm run build` | Sin errores; generó `dist/` |
| `npm run db:migrate` | `Migraciones aplicadas en data/reservas.db: 001_initial` |
| `npm run db:seed` | `Inventario cargado: 5 unidades en data/reservas.db` |
| `npm run db:reset` | `Advertencia: se van a eliminar las reservas de la base de datos de prueba: data/test.db` y `Base de datos de prueba reiniciada: data/test.db`; `data/reservas.db` no fue modificada |
| `npm start` (`node dist/server.js`) | Servidor escuchando en `http://127.0.0.1:3000`; `GET /equipment` → 501 `NOT_IMPLEMENTED`; `GET /equipment/MIC-01/availability` sin zona horaria → 400 `VALIDATION_ERROR`; `GET /ruta-inexistente` → 404 `NOT_FOUND`; `POST /reservations` con cuerpo válido → 501 `NOT_IMPLEMENTED`; `POST /reservations` con JSON malformado → 400 `VALIDATION_ERROR` |
| `npm run dev` (`tsx watch src/server.ts`) | Servidor escuchando y respondiendo en `http://127.0.0.1:3000` |
| Inspección directa de SQLite (`data/reservas.db` y `data/test.db`) | 5 unidades en cada base (`FUE-01`, `MIC-01`, `MIC-02`, `MUL-01`, `OSC-01`), 0 reservas, una única migración registrada. Sin duplicados tras varias ejecuciones |

**Ajustes realizados durante la verificación**
- `@fastify/type-provider-typebox@6` ya no exporta `FastifyTypeBox` ni `TypeBoxValidatorCompiler` como valor por defecto: se creó el alias propio `TypeboxApp` en `src/types.ts` y se importó `TypeBoxTypeProvider` como tipo.
- Fastify v5 ya no admite `logLevel` en las opciones raíz: el nivel se define con `logger: { level }` y se valida contra la lista de niveles de Pino.
- `setErrorHandler` tipa el error como `unknown` por defecto: se pasa el genérico `FastifyError` y los errores 4xx de Fastify (por ejemplo, JSON malformado) responden con su `statusCode` y el código `VALIDATION_ERROR`/`NOT_FOUND` en vez de 500.

**Verificación de versiones (2026-10-21), con el visto bueno del desarrollador**
| Comprobación | Resultado real |
|---|---|
| Formato de listas | `SPEC.md` §8 (líneas 235-244) no define el formato de las listas; se adoptó el arreglo JSON simple, ratificado por el desarrollador |
| `npm ls --all` | Sin peers inválidos ni dependencias requeridas insatisfechas; los únicos `UNMET` son opcionales por plataforma (binarios de esbuild para otros SO, `fsevents`, plugins opcionales de Vitest) |
| `typebox` / type provider / Fastify | `@fastify/type-provider-typebox@6.3.0` exige `typebox ^1.1.14` y `ajv-formats ^3.0.1`; `@sinclair/typebox` solo es peer de la v5 (2025-07-14). Ambas líneas se desarrollan contra `fastify ^5.0.0` |
| TypeScript 5.9.3 / 6.0.3 / 7.0.2 | Los tres dan 0 errores sobre el proyecto y diagnósticos idénticos sobre un archivo sonda; 7.0.2 además emite correctamente |
| Cambio aplicado | `typescript` de `^5.9.3` a `^6.0.3`; `npm install` → `changed 1 package, and audited 96 packages in 5s`; 0 vulnerabilidades |
| `npx tsc --version` | `Version 6.0.3` |
| `npm run typecheck` (con TS 6.0.3) | Sin errores (0 diagnósticos) |
| `npm test` (con TS 6.0.3) | 3 archivos de prueba, 11 pruebas aprobadas, 17 `todo` pendientes, 0 fallos |
| `npm run build` (con TS 6.0.3) | Sin errores; generó `dist/` |
| `npm run db:migrate` / `db:seed` / `db:reset` | `Migraciones aplicadas en data/reservas.db: 001_initial`; `Inventario cargado: 5 unidades en data/reservas.db`; `Advertencia: se van a eliminar las reservas de la base de datos de prueba: data/test.db` + `Base de datos de prueba reiniciada: data/test.db` |
| `npm start` (con TS 6.0.3) | Servidor en `http://127.0.0.1:3000`; `GET /equipment` → 501 `NOT_IMPLEMENTED`; disponibilidad sin zona horaria → 400 `VALIDATION_ERROR`; ruta inexistente → 404 `NOT_FOUND`; sin errores en el log del servidor |

**Adaptación a `DB_PATH` / `TEST_DATABASE_PATH` (2026-10-21), aprobada por el desarrollador**
| Comprobación | Resultado real |
|---|---|
| Pruebas escritas antes de implementar | 5 pruebas nuevas en `tests/persistence.test.ts` (guarda contra la base de desarrollo, capitalización en Windows, destino distinto permitido, recreación del esquema e inventario, y no borrado de la base de desarrollo) |
| `npm run typecheck` | Sin errores (0 diagnósticos) |
| `npm test` | 3 archivos de prueba, 16 pruebas aprobadas, 17 `todo` pendientes, 0 fallos (antes: 11 aprobadas) |
| `npm run build` | Sin errores; generó `dist/` |
| `npm run db:migrate` | `Migraciones aplicadas en data/reservas.db: 001_initial` |
| `npm run db:seed` | `Inventario cargado: 5 unidades en data/reservas.db` |
| `npm run db:reset` | Emitió la advertencia y reinició `data/test.db`; `data/reservas.db` intacta |
| `db:reset` con `DB_PATH` = `TEST_DATABASE_PATH` | `db:reset no puede reiniciar la base de datos de desarrollo (...)`; código de salida 1; base de desarrollo sin modificar (5 unidades, 0 reservas) |
| `db:reset` con `data/RESERVAS.DB` | Mismo aborto y código de salida 1 (comparación insensible a mayúsculas en Windows) |
| `npm start` (con TS 6.0.3) | Servidor en `http://127.0.0.1:3000`; `GET /equipment` → 501 `NOT_IMPLEMENTED`; sin errores en el log |
| Limpieza | `data/lab.db` (5 unidades, 0 reservas) eliminada con aprobación humana; `data/reservas.db` es la base de desarrollo |
