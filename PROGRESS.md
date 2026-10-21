# Progreso y decisiones

## Estado
- [x] 1 Andamiaje - Implementada
- [x] 2 Base de datos - Implementada
- [x] 3 Reglas de reservas - Implementada
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
| 2026-10-21 | Validar los instantes ISO 8601 en la capa de negocio (`src/shared/iso-date.ts`) y no solo con el patrón del esquema de transporte | El patrón de `IsoDateTimeSchema` acepta fechas que no existen en el calendario (por ejemplo `2026-02-30`), y V8 las convierte por rollover a marzo. `SPEC.md` RN-08 exige un instante válido con zona explícita | Aceptar cualquier valor que case con el patrón de transporte (deja pasar `2026-02-30`) | `parseIsoToUtc` valida mes, día real del mes (con años bisiestos), hora, minuto, segundo y desplazamiento; devuelve `null` o lanza `ValidationError` (400) |
| 2026-10-21 | Resolver la superposición con una única consulta SQL parametrizada (`findActiveConflicts`) compartida por la creación y la disponibilidad | `SPEC.md` RN-07 exige lógica coherente entre disponibilidad y creación; RN-06 excluye las reservas canceladas | Duplicar el predicado de superposición en cada servicio | La consulta aplica `equipment_id = ? AND status = 'ACTIVE' AND start_at < nuevoFin AND end_at > nuevoInicio`; los instantes se guardan normalizados a UTC con formato de ancho fijo (`YYYY-MM-DDTHH:mm:ss.sssZ`), por lo que la comparación por cadena coincide con la cronológica |
| 2026-10-21 | Exponer `transaction<T>(work)` en el repositorio y dejar la decisión de rechazar en el servicio | RN-07 pide que la comprobación y la escritura protegidas por una transacción de SQLite; la regla de negocio (409 `OVERLAP`) pertenece al servicio, la atomicidad al repositorio | Poner la transacción dentro del repositorio junto con la regla de negocio, o una transacción en la capa HTTP | `reservations.service` abre la transacción, consulta conflictos, lanza `OverlapError` si hay alguno e inserta; si la transacción falla, SQLite revierte los cambios (cubierto por un test de rollback) |
| 2026-10-21 | Inyectar dependencias como objeto (`{ reservations, equipment }`) en los servicios de reservas y de equipment | Los dos servicios necesitan el inventario y las reservas; un objeto evita el orden posicional de los argumentos y deja explícita la dependencia cruzada | Parámetros posicionales (`createService(repository, equipmentRepository)`) | Se actualizaron `reservations.routes.ts` y `equipment.routes.ts`; el módulo de equipment importa el repositorio de reservas y viceversa, sin reglas duplicadas |
| 2026-10-21 | `POST /reservations` fija explícitamente el código 201 en la ruta | Fastify no asigna 201 por defecto en `POST`; sin `reply.status(201)` la ruta respondía 200 pese a declarar el esquema de respuesta 201 | Dejar el 200 implícito y cambiar el esquema de respuesta | La ruta hace `reply.status(201)`; verificado manualmente (`HTTP 201` con la reserva devuelta) |
| 2026-10-21 | Aplicar el máximo de 80 caracteres del solicitante sobre el valor ya recortado | `SPEC.md` RN-02 dice que se recorta antes de guardar; el límite aplica a lo que se persiste | Validar los 80 caracteres sobre el valor original sin recortar | Un solicitante de 100 caracteres con espacios alrededor se acepta si el valor recortado entra en 80; el test del servicio lo documenta |
| 2026-10-21 | Mantener el `415 Unsupported Media Type` de `POST /reservations/:id/cancel` ante un `Content-Type` no soportado, sin tocar la lógica de negocio ni el transporte | Decisión del desarrollador (2026-10-21): la corrección depende de qué exija el contrato de la tarea 4, que todavía no está evaluado | Aceptar `application/x-www-form-urlencoded` o ignorar el `Content-Type` en las rutas `POST` sin cuerpo (cambio de transporte sin análisis previo) | La limitación queda documentada en la tarea 3 de este archivo; si la tarea 4 exige admitir ese tipo de contenido, se corrige allí con una prueba específica |

## Evidencias de uso del agente
- Captura del modelo seleccionado en OpenCode: `docs/agent-evidence/Evidencia de la versión de opencode y del modelo seleccionado.png`
- Captura del primer prompt con su respuesta: `docs/agent-evidence/Captura del primer prompt.png`
- Git diff luego del primer prompt: `docs\agent-evidence\Captura de git diff luego del primer prompt.png`
- Captura del segundo prompt: `docs/agent-evidence/Captura de pantalla del segundo PROMPT.png`
- Resumen de la respuesta segundo prompt: `docs/agent-evidence/Resumen final respuesta del segundo PROMPT parte 1.png`
- Continuación del resumen: `docs/agent-evidence/Resumen final respuesta del segundo PROMPT parte 2.png`
- Git diff luego del segundo prompt: `docs/agent-evidence/Git diff luego del segundo PROMPT.png`
- Comprobaciones manuales: `docs/agent-evidence/Comprobaciones manuales segundo PROMPT.png` 
- Captura del tercer prompt: `docs/agent-evidence/Captura de pantalla del tercer PROMPT.png`
- Resultados finales del tercer prompt: `docs/agent-evidence/Captura de resultados reales del tercer PROMPT.png`
- Git diff luego del tercer prompt: `docs/agent-evidence/Git diff luego del tercer PROMPT.png`
- Comprobaciones manuales: `docs/agent-evidence/Comprobaciones manuales tercer PROMPT.png`
- Captura del cuarto prompt: `docs/agent-evidence/Captura de pantalla del cuarto PROMPT.png`
- Captura de la respuesta final del cuarto prompt parte 1: `docs/agent-evidence/Respuesta Final Promp 4.png`
- Captura de la respuesta final del cuarto prompt parte 2: `docs/agent-evidence/Respuesta Final Promp 4 - Parte 2.png`
- Captura de la respuesta final del cuarto prompt parte 3: `docs/agent-evidence/Respuesta Final Promp 4 - Parte 3.png`
- Git diff luego del cuarto prompt: `docs/agent-evidence/Git diff luego del cuarto PROMPT.png`
- Comprobaciones manuales: `docs/agent-evidence/Comprobaciones manuales cuarto PROMPT.png`

## Verificaciones iniciales ejecutadas por mí
| Comando o verificación | Versión | Resultado real |
|---|---|---|
| Selección del modelo en OpenCode | OpenCode 1.19.3; MiniMax M3.1 Flash (free) | Modelo seleccionado correctamente |
| Configuración de permisos | OpenCode 1.19.3 | Modo lectura configurado correctamente|
| Prueba: lectura de `SPEC.md` y reglas del proyecto | OpenCode 1.19.3; MiniMax M3.1 Flash (free) | Ejecutada; respuesta obtenida: resumen de las reglas del proyecto, sin modificaciones de los archivos |


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

**Sin lógica de negocio:** en la tarea 1 los repositorios y servicios eran un andamiaje sin implementar y respondían `501 NOT_IMPLEMENTED`; el `409 OVERLAP` y la transactionalidad de RN-04/RN-07 quedan para la tarea 3.

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

### Verificaciones ejecutadas por mí
| Comando o verificación | Versión | Resultado real |
|---|---|---|
| `npm test` | Vitest 5.0.5 | Sin errores reportados; 3 archivos pasados, 16 pruebas pasadas y 17 pruebas `todo` |
| `npm run typecheck` | TypeScript 6.0.3 | Exit 0 |
| `npm run build` | TypeScript 6.0.3 | Exit 0 |

## Tarea 2 — Base de datos y módulo equipment (SPEC.md §7, RF-01 y §12)
**Estado:** implementada. Requisitos atendidos: §7 (modelo de datos e idempotencia de la inicialización), RF-01 (consulta de inventario), §12 (comandos documentados de migración, carga y reinicio del entorno de prueba).

**Archivos modificados**
- `src/db/migrations/001_initial.ts` — tablas `equipment` y `reservations` según §7: `equipment(id, name)`; `reservations(id, equipment_id, requester, start_at, end_at, status, created_at, cancelled_at)` con `CHECK (status IN ('ACTIVE','CANCELLED'))`, `cancelled_at` nullable y `FOREIGN KEY (equipment_id) REFERENCES equipment(id)`.
- `src/db/database.ts` — `PRAGMA foreign_keys = ON` y `journal_mode = WAL` en cada conexión.
- `src/db/migrator.ts` — aplica cada migración dentro de una transacción y la tabla `schema_migrations` evita repetirlas.
- `src/db/seed.ts` — `readInventory` valida la forma de `data/inventory.json`; `seedInventory` inserta con `ON CONFLICT (id) DO UPDATE` sobre `equipment` y no toca la tabla `reservations`.
- `src/db/reset.ts` — `assertSeparateDatabases` aborta si el destino es la base de desarrollo; `resetTestDatabase` avisa por consola antes de borrar.
- `src/config/index.ts` — `DB_PATH` (predeterminado `data/reservas.db`) y `TEST_DATABASE_PATH` (predeterminado `data/test.db`).
- `src/modules/equipment/equipment.repository.ts` — `list()` y `findById()` con consultas parametrizadas.
- `src/modules/equipment/equipment.service.ts` y `equipment.routes.ts` — `GET /equipment` devuelve el inventario como arreglo JSON; la consulta de disponibilidad sigue respondiendo `501`.
- `src/errors/index.ts` — redacción del mensaje de "no disponible" corregida.
- `tests/equipment.test.ts`, `tests/persistence.test.ts`, `tests/helpers/test-app.ts` — el helper ahora siembra el inventario en la base en memoria.

**Verificaciones ejecutadas por el agente (resultados reales)**
| Comprobación | Resultado real |
|---|---|
| Pruebas escritas antes de implementar | 6 pruebas nuevas: inventario precargado, consulta sin efectos sobre los datos, seed sin duplicar equipos, seed sin borrar reservas, clave foránea activa, `CHECK` de estado y `cancelled_at` informado |
| `npm run typecheck` | Sin errores (0 diagnósticos) |
| `npm test` | 3 archivos de prueba, 21 aprobadas, 16 `todo` pendientes, 0 fallos (antes: 16 aprobadas) |
| `npm run build` | Sin errores; generó `dist/` |
| `GET /equipment` con `npm start` | `200 OK` → `[{"id":"FUE-01","name":"Fuente de alimentación"},{"id":"MIC-01","name":"Microscopio digital"},{"id":"MIC-02","name":"Microscopio digital"},{"id":"MUL-01","name":"Multímetro"},{"id":"OSC-01","name":"Osciloscopio"}]` |
| `GET /equipment/MIC-01/availability` | `501 NOT_IMPLEMENTED` (la consulta de disponibilidad corresponde a la tarea 3) |
| `npm run db:reset` | `Advertencia: se van a eliminar las reservas de la base de datos de prueba: data/test.db` + `Base de datos de prueba reiniciada: data/test.db` |
| Seed por CLI con `DB_PATH` apuntando a un archivo temporal, 3 ejecuciones | 5 unidades sin duplicar (`FUE-01`, `MIC-01`, `MIC-02`, `MUL-01`, `OSC-01`) y la reserva ficticia conservada con estado `ACTIVE` |
| Estado de `data/reservas.db` y `data/test.db` | 5 unidades, 0 reservas y una única migración (`001_initial`) registrada en cada base |

### Verificaciones ejecutadas por mí
| Comando o verificación | Versión | Resultado real |
|---|---|---|
| `npm run typecheck` | TypeScript 6.0.3 | Exit 0 |
| `npm test` | Vitest 5.0.5 | Sin errores reportados; 3 archivos pasados, 21 pruebas pasadas y 16 pruebas `todo` |
| `npm run build` | TypeScript 6.0.3 | Exit 0 |
|Revisar el modelo de datos de §7 y el formato de `GET /equipment` contra la especificación.| - | Todo coincide correctamente |

## Tarea 3 — Reglas de reservas (SPEC.md §5 RF-03/RF-04, §6 RN-01 a RN-08, §11 CA-01 a CA-08)
**Estado:** implementada, pendiente de verificación humana. Seatangono los servicios de reservas y de equipment, el repositorio de reservas y las utilidades compartidas de instantes ISO. No se modificaron `SPEC.md` ni `data/inventory.json`.

**Requisitos atendidos:** RF-03 (crear reserva), RF-04 (cancelar conservando datos, sin borrado físico, 409 al cancelar dos veces), RF-02 (disponibilidad coherente con la creación), RN-01 (orden 400 → 404 → 409), RN-02 (solicitante no vacío, recortado, máx. 80), RN-03 (inicio < fin), RN-04 (criterio de superposición, límites consecutivos permitidos), RN-05 (independencia entre unidades), RN-06 (las canceladas no bloquean), RN-07 (transacción para comprobación + inserción), RN-08 (instantes con zona explícita, normalizados a UTC).

**Archivos creados**
- `src/shared/iso-date.ts` — `parseIsoToUtc` (devuelve `null` si el instante no es válido) y `parseRequiredInstant` (lanza `ValidationError`, 400). Valida el calendario: mes, día real del mes (años bisiestos), hora, minuto, segundo y desplazamiento horario.
- `tests/reservations.service.test.ts` — 19 pruebas del servicio y del repositorio, sin pasar por HTTP.
- `tests/helpers/reservations.ts` — utilidades compartidas por los archivos de prueba (`postReservation`, `createReservation`, `cancelReservation`, `availabilityUrl`).

**Archivos modificados**
- `src/modules/reservations/reservations.repository.ts` — `list`, `findById`, `findActiveConflicts` (consulta parametrizada de superposiciones sobre reservas `ACTIVE`), `insert`, `cancel` (actualiza el estado; devuelve `undefined` si no existe o ya estaba cancelada) y `transaction<T>()`.
- `src/modules/reservations/reservations.service.ts` — `create` (valida solicitante, instantes e intervalo; comprueba la existencia de la unidad; dentro de una transacción comprueba conflictos e inserta), `cancel` (404 si no existe, 409 `ALREADY_CANCELLED` si ya estaba cancelada, conserva los datos y libera el intervalo), `getById` (404) y `list`.
- `src/modules/equipment/equipment.service.ts` — `checkAvailability` usa la misma consulta de conflictos que la creación y devuelve `start`/`end` normalizados a UTC.
- `src/modules/reservations/reservations.routes.ts` — inyecta ambos repositorios y fija `reply.status(201)` en `POST /reservations`.
- `src/modules/equipment/equipment.routes.ts` — inyecta el repositorio de reservas para la disponibilidad.
- `tests/reservations.test.ts` — los 17 `it.todo` de la tarea 1 se reemplazaron por pruebas reales (24 casos).
- `tests/equipment.test.ts` — se agregaron 5 pruebas de disponibilidad (CA-08) y se conserva el `todo` de RF-01.
- `tests/helpers/test-app.ts` — se exporta `createTestDatabase()` (base en memoria migrada y sembrada) reutilizado por `createTestContext()`.

**Verificaciones ejecutadas por el agente (resultados reales)**
| Comprobación | Resultado real |
|---|---|
| Pruebas escritas antes de implementar | Fase roja: `npx vitest run tests/reservations.test.ts tests/reservations.service.test.ts tests/equipment.test.ts` → 3 archivos fallidos, 38 pruebas fallidas, 10 aprobadas, 1 `todo` (los 501 `NOT_IMPLEMENTED` del andamiaje) |
| `npm run typecheck` | Sin errores (0 diagnósticos) |
| `npm test` | 4 archivos de prueba, 63 aprobadas, 2 `todo` pendientes (RF-01 sin duplicar al reiniciar y CA-07 de persistencia, de otras tareas), 0 fallos (antes: 21 aprobadas y 16 `todo`) |
| `npm run build` | Sin errores; generó `dist/` |
| `POST /reservations` (curl, base temporal) | `HTTP 201` con `{"id":"8916b472-…","equipmentId":"MIC-01","requester":"Ana Ficticia","startAt":"2026-11-02T13:00:00.000Z","endAt":"2026-11-02T14:00:00.000Z","status":"ACTIVE","createdAt":"…","cancelledAt":null}` |
| `POST /reservations` superpuesto (10:30-11:30 sobre 10:00-11:00) | `HTTP 409` → `{"error":{"code":"OVERLAP","message":"La unidad \"MIC-01\" ya tiene una reserva activa para ese intervalo."}}` |
| `POST /reservations` con unidad inexistente | `HTTP 404` → `{"error":{"code":"NOT_FOUND","message":"No existe la unidad \"MIC-99\"."}}` |
| `POST /reservations` con fecha inexistente (`2026-02-30`) | `HTTP 400` → `VALIDATION_ERROR` con mensaje sobre el instante ISO 8601 |
| `POST /reservations` con inicio igual al fin | `HTTP 400` → `{"error":{"code":"VALIDATION_ERROR","message":"El inicio de la reserva debe ser anterior al fin."}}` |
| `GET /equipment/MIC-01/availability` (10:30-11:30) | `HTTP 200` → `{"equipmentId":"MIC-01","start":"2026-11-02T13:30:00.000Z","end":"2026-11-02T14:30:00.000Z","available":false,"conflicts":["8916b472-…"]}` |
| `GET /equipment/MIC-01/availability` (12:00-13:00) | `HTTP 200` → `available":true,"conflicts":[]` |
| `POST /reservations/:id/cancel` (curl, sin cuerpo) | `HTTP 200` con la reserva en `CANCELLED` y `cancelledAt` informado; los datos originales se conservan |
| `POST /reservations/:id/cancel` repetido | `HTTP 409` → `{"error":{"code":"ALREADY_CANCELLED",…}}`; `cancelled_at` no cambia (verificado en la base y en el test) |
| `POST /reservations` sobre el intervalo liberado | `HTTP 201`: la reserva cancelada no bloquea el horario (RN-06) |
| `GET /reservations?equipmentId=MIC-01` | `HTTP 200` con las reservas activas y canceladas, con `status` y `cancelledAt` |
| Eliminación de las 2 reservas ficticias de `data/reservas.db` (aprobada por el desarrollador) | `DELETE FROM reservations WHERE id = ?` sobre los 2 ids: 1 fila borrada por cada id; estado final verificado: 5 unidades (`FUE-01`, `MIC-01`, `MIC-02`, `MUL-01`, `OSC-01`), 0 reservas y una única migración `001_initial` |

**Hallazgos y pendientes**
- `POST /reservations/:id/cancel` responde `415 Unsupported Media Type` si el cliente envía un `Content-Type` no soportado (por ejemplo el `application/x-www-form-urlencoded` que agrega `Invoke-WebRequest` de PowerShell). Con `curl -X POST` sin cuerpo o con `app.inject` responde correctamente. **Limitación documentada y mantenida sin cambios por decisión del desarrollador (2026-10-21)**: no se altera la lógica de negocio ni el manejo del transporte hasta evaluar qué exige el contrato de la tarea 4. Si ese contrato obliga a admitir ese tipo de contenido, se corrigirá en la tarea 4 agregando una prueba específica.
- La verificación manual inicial se hizo por error contra `data/reservas.db` (la base de desarrollo) en lugar de una base temporal, y dejó 2 reservas ficticias `ACTIVE`: `f06a913f-9d73-4da9-b020-1242d315095b` (MIC-01, Carla Ficticia) y `c63f6364-d87a-4a29-aaf5-b1608d54e173` (MIC-02, Diego Ficticio). **Eliminadas con aprobación del desarrollador (2026-10-21)**, solo esas dos filas; el estado final de `data/reservas.db` se verificó en 5 unidades, 0 reservas y una única migración `001_initial`, tal como figura en la tarea 2.
- CA-07 (persistencia tras reiniciar el servidor) y el `todo` de RF-01 siguen pendientes y pertenecen a las tareas 5 y 2 respectivamente. **No se marcan como completados** hasta implementar y verificar la tarea correspondiente.
- La documentación de `README.md` (§12) todavía no incluye los ejemplos de los endpoints de reservas, que ahora responden con datos reales. Queda pendiente de la tarea 7.

### Verificaciones ejecutadas por mí
| Comando o verificación | Versión | Resultado real |
|---|---|---|
| `npm run typecheck` | TypeScript 6.0.3 | Exit 0 |
| `npm test` | Vitest 5.0.5 | Sin errores reportados; 4 archivos pasados, 63 pruebas pasadas y 2 pruebas `todo` |
| `npm run build` | TypeScript 6.0.3 | Exit 0 |
| Revisar las reglas de RN-01 a RN-08 y los criterios CA-01 a CA-08 contra la implementación | - | Todo concuerda perfectamente |



