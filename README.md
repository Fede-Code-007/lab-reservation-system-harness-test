# Sistema de reservas de equipos de laboratorio

Aplicación local para gestionar reservas de equipos físicos de un laboratorio. Permite consultar el inventario y la disponibilidad por unidad e intervalo, crear y cancelar reservas, y conservar el historial mediante SQLite. El proyecto se desarrolló con asistencia de un agente de programación y se verificó mediante pruebas automatizadas y comprobaciones humanas.

## Documentación relacionada

- [Especificación funcional](SPEC.md): requisitos, reglas de negocio, modelo de datos, contrato de la API y criterios de aceptación.
- [Progreso y decisiones](PROGRESS.md): evolución, resultados de verificaciones y decisiones técnicas.
- [Instrucciones del agente](AGENTS.md): reglas operativas y criterios de trabajo.
- [Episodio 1 — Reglas de reservas](docs/episodes/EPISODIO%201.MD).
- [Episodio 2 — Contrato de la API REST](docs/episodes/EPISODIO%202.MD).
- [Episodio 3 — Persistencia](docs/episodes/EPISODIO%203.MD).
- [Entorno del agente](docs/agent-evidence/ENTORNO.md).
- [Evidencias del agente y verificaciones](docs/agent-evidence/).

---

# 1. Especificación breve

## Problema y alcance

La coordinación de un laboratorio registra solicitudes mediante mensajes y una planilla, lo que puede producir reservas superpuestas o cancelaciones que siguen bloqueando horarios. Esta aplicación local permite gestionar reservas de unidades físicas identificadas individualmente.

El sistema no administra el inventario: lee el inventario precargado en `data/inventory.json`.

| ID | Equipo |
|---|---|
| `MIC-01` | Microscopio digital |
| `MIC-02` | Microscopio digital |
| `OSC-01` | Osciloscopio |
| `MUL-01` | Multímetro |
| `FUE-01` | Fuente de alimentación |

Cada identificador representa una unidad física distinta, incluso cuando dos unidades son del mismo tipo.

## Requisitos verificables

- Consultar las cinco unidades del inventario.
- Consultar disponibilidad de una unidad para un intervalo.
- Crear una reserva con identificador, unidad, solicitante, inicio, fin y estado.
- Cancelar una reserva sin eliminar su fila ni sus datos históricos.
- Recuperar reservas activas y canceladas después de detener y reiniciar la aplicación sin borrar la base.
- Exponer el historial, incluidos los estados y la fecha de cancelación cuando corresponda.
- Validar los datos y rechazar superposiciones de reservas activas para la misma unidad.

## Reglas y supuestos

- El identificador de equipo debe existir.
- El solicitante no puede estar vacío ni compuesto solo por espacios. Se recortan los espacios exteriores y se admiten hasta 80 caracteres.
- El inicio debe ser estrictamente anterior al fin.
- Los instantes deben ser fechas válidas en formato ISO 8601 con zona horaria explícita; se normalizan a UTC.
- Los intervalos son semiabiertos: `[inicio, fin)`. Una reserva que termina a las 11:00 permite otra que empieza a las 11:00.
- Solo las reservas `ACTIVE` bloquean disponibilidad. Una reserva `CANCELLED` conserva su registro, pero libera el intervalo.
- La creación y la consulta de disponibilidad usan la misma lógica de conflictos.
- Se permiten reservas en el pasado; no se establecen límites de duración ni de anticipación.
- La interfaz muestra y captura horas en `America/Argentina/Buenos_Aires` y envía instantes normalizados a UTC.

### Criterios de aceptación principales

1. Una reserva válida se crea y devuelve `201 Created`.
2. Una reserva activa superpuesta para la misma unidad se rechaza con `409 Conflict` y `code: OVERLAP`.
3. Los intervalos consecutivos se permiten.
4. Dos unidades distintas pueden reservarse para el mismo intervalo.
5. Los datos inválidos se rechazan; las unidades o reservas inexistentes producen `404 Not Found`.
6. La cancelación devuelve `200 OK`, cambia el estado a `CANCELLED` y conserva los datos originales.
7. El intervalo de una reserva cancelada puede volver a reservarse.
8. Las reservas activas y canceladas mantienen sus identificadores, datos y estados después de reiniciar el servidor sin ejecutar `db:reset`.

La especificación completa, incluidos los requisitos funcionales y no funcionales y los criterios de aceptación, está en [`SPEC.md`](SPEC.md). La evolución de las decisiones puede recuperarse en Git y en [`PROGRESS.md`](PROGRESS.md).

---

# 2. Solución

## Arquitectura y tecnologías

La solución separa la interfaz, el transporte HTTP, las reglas de negocio y el acceso a datos.

```text
Cliente React
    |
    v
API REST (Fastify)
    |
    v
Servicios de negocio
    |
    v
Repositorios
    |
    v
SQLite
```

| Tecnología | Versión documentada | Uso |
|---|---:|---|
| Node.js | 24.x; entorno de desarrollo registrado: `v24.14.1` | Entorno de ejecución |
| npm | `11.11.0` en el entorno registrado | Gestión de dependencias |
| TypeScript | `6.0.3` | Lenguaje y comprobación estática |
| Fastify | `5.12.7` | API REST |
| `@fastify/type-provider-typebox` | `6.3.0` | Tipado de esquemas para Fastify |
| `typebox` | `1.4.2` | Esquemas y validación |
| `ajv-formats` | `3.0.1` | Dependencia de validación requerida por el proveedor de tipos |
| `better-sqlite3` | `13.0.3` | Persistencia SQLite |
| Vitest | `5.0.5` | Pruebas automatizadas |
| React | `19.3.1` | Interfaz web |
| Vite | `8.3.5` | Desarrollo y compilación del cliente |

Las versiones efectivas de las dependencias se fijan en `package-lock.json` y `client/package-lock.json`. El cliente es un proyecto npm independiente dentro de `client/`, por lo que necesita instalar sus dependencias por separado.

### Estructura principal

```text
.
├── SPEC.md
├── PROGRESS.md
├── AGENTS.md
├── opencode.json
├── package.json
├── package-lock.json
├── data/
│   └── inventory.json
├── docs/
│   ├── episodes/
│   └── agent-evidence/
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   ├── db/
│   │   └── migrations/
│   ├── errors/
│   ├── modules/
│   │   ├── equipment/
│   │   └── reservations/
│   ├── schemas/
│   └── shared/
├── client/
│   ├── package.json
│   ├── package-lock.json
│   └── src/
└── tests/
```

## Requisitos previos e instalación

Se requiere Node.js 24.x y npm compatible con los archivos de bloqueo. Desde la raíz del repositorio:

```bash
npm ci
npm ci --prefix client
```

## Configuración y persistencia

| Variable | Valor predeterminado | Descripción |
|---|---|---|
| `HOST` | `127.0.0.1` | Dirección de escucha del backend |
| `PORT` | `3000` | Puerto del backend |
| `DB_PATH` | `data/reservas.db` | Archivo SQLite de desarrollo |
| `TEST_DATABASE_PATH` | `data/test.db` | Archivo SQLite para pruebas y reinicio |
| `INVENTORY_FILE` | `data/inventory.json` | Inventario inicial |
| `LOG_LEVEL` | `info` | Nivel de registro |
| `API_PROXY_TARGET` | `http://127.0.0.1:3000` | Destino del proxy de Vite |

Todas las variables son opcionales. Las rutas relativas se resuelven desde la raíz del proyecto.

El servidor aplica las migraciones y carga el inventario al arrancar. También se pueden ejecutar explícitamente:

```bash
npm run db:migrate
npm run db:seed
```

Estas operaciones son idempotentes: no duplican migraciones ni unidades, y la carga del inventario no elimina reservas. La persistencia se guarda en SQLite; las bases de datos generadas no se versionan en Git.

**El arranque normal no borra los datos.** Para reiniciar la base de pruebas:

```bash
npm run db:reset
```

Este comando opera sobre `TEST_DATABASE_PATH` (por defecto, `data/test.db`), advierte antes de borrar y aborta si detecta que el destino coincide con `DB_PATH`. No debe usarse para reiniciar la base de desarrollo.

## Ejecución

### Backend

Modo desarrollo:

```bash
npm run dev
```

Compilar y ejecutar el backend compilado:

```bash
npm run build
npm start
```

La API queda disponible por defecto en `http://127.0.0.1:3000`.

### Interfaz web

En otra terminal:

```bash
npm run client:dev
```

Abrir `http://127.0.0.1:5173`. Deben mantenerse activos el backend y el servidor de desarrollo de Vite. El cliente envía las solicitudes mediante el proxy de Vite.

Para compilar el cliente y servir localmente el resultado compilado:

```bash
npm run client:build
npm --prefix client run preview
```

La vista previa utiliza por defecto `http://127.0.0.1:4173`.

## API REST

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/equipment` | Consultar el inventario |
| `GET` | `/equipment/:id/availability?start=...&end=...` | Consultar disponibilidad |
| `GET` | `/reservations?equipmentId=...` | Consultar historial; filtro por equipo opcional |
| `POST` | `/reservations` | Crear una reserva |
| `GET` | `/reservations/:id` | Consultar una reserva |
| `POST` | `/reservations/:id/cancel` | Cancelar una reserva |

Las listas se devuelven como arreglos JSON simples. Los códigos HTTP principales son `200` para consultas y cancelación, `201` para creación, `400` para datos inválidos, `404` para recursos inexistentes y `409` para conflictos o reservas ya canceladas. Los errores tienen el formato:

```json
{
  "error": {
    "code": "OVERLAP",
    "message": "La unidad ya tiene una reserva activa para ese intervalo."
  }
}
```

### Ejemplo de solicitud y respuesta

Solicitud de creación:

```http
POST /reservations
Content-Type: application/json
```

```json
{
  "equipmentId": "MIC-01",
  "requester": "Carla Ejemplo",
  "startAt": "2026-10-23T10:00:00-03:00",
  "endAt": "2026-10-23T11:00:00-03:00"
}
```

La respuesta satisfactoria es `201 Created`, con una reserva `ACTIVE`; los instantes se normalizan a UTC. Si se intenta crear para `MIC-01` una reserva de 10:30 a 11:30 mientras la anterior sigue activa, la API responde `409 Conflict` con `code: OVERLAP`.

## Verificación automatizada

Ejecutar desde la raíz:

```bash
npm run typecheck
npm test
npm run build
npm run client:build
```

Comandos adicionales:

```bash
npm run test:watch
npm --prefix client run typecheck
npx vitest run tests/api.test.ts
npx vitest run tests/persistence.test.ts
```

### Resultados finales ejecutados

| Comando o verificación | Versión | Resultado observado |
|---|---|---|
| `npm run typecheck` | TypeScript `6.0.3` | Exit 0 |
| `npm test` | Vitest `5.0.5` | 8 archivos de prueba, 134 pruebas aprobadas, 0 fallos y 0 pruebas `todo` |
| `npm run build` | TypeScript `6.0.3` | Exit 0 |
| `npm run client:build` | TypeScript `6.0.3` + Vite `8.3.5` | Exit 0; bundle generado en `client/dist/` |
| Crear reserva A (`MIC-01`, 10:00–11:00, UTC−03:00) | Node.js 24; Fastify `5.12.7` | `201 Created`, `ACTIVE`; ID `3ddea20d-f091-4f2e-8236-194465500bb7`; intervalo normalizado a 13:00Z–14:00Z |
| Crear reserva B (`MIC-01`, 12:00–13:00, UTC−03:00) | Node.js 24; Fastify `5.12.7` | `201 Created`, `ACTIVE`; ID `6150b7a7-cd9e-4cac-b3b0-6a7d302a5881`; intervalo normalizado a 15:00Z–16:00Z |
| Cancelar B | Node.js 24; Fastify `5.12.7` | `200 OK`, estado `CANCELLED`; `cancelledAt` informado; demás datos conservados |
| Listar antes del reinicio | Node.js 24; Fastify `5.12.7` | `200 OK`; A `ACTIVE` y B `CANCELLED` en el historial |
| Reiniciar sin `db:reset` | Node.js 24; npm `11.11.0` | Servidor detenido y reiniciado con `npm run dev`, sin borrar la base |
| Listar después del reinicio | Node.js 24; Fastify `5.12.7`; SQLite | `200 OK`; ambas reservas conservaron ID, `createdAt`, estado y `cancelledAt` cuando correspondía; comparación manual |
| Crear 10:30–11:30 sobre A | Node.js 24; Fastify `5.12.7` | `409 Conflict`, `code: OVERLAP` |
| Reservar nuevamente 12:00–13:00, horario de B cancelada | Node.js 24; Fastify `5.12.7` | `201 Created`, `ACTIVE`; ID `18299f1e-83e6-405c-8e75-50e9e2f6ffd4` |
| Verificación humana de la interfaz en navegador | React `19.3.1`; Vite `8.3.5` | Completada: inventario, disponibilidad, creación, conflicto por superposición, cancelación e historial. Evidencias en `docs/agent-evidence/` |
| Revisión del README contra el código, scripts y respuestas observadas | Verificación humana | Todo correcto |

La prueba de persistencia se realizó con el mismo archivo SQLite y sin ejecutar `db:reset` entre el cierre y el reinicio. Las pruebas automatizadas usan bases en memoria o archivos temporales; la base de desarrollo se verificó separadamente.

### Procedimiento reproducible para verificar la interfaz

En PowerShell, desde la raíz del repositorio, iniciar el backend con una base temporal:

```powershell
$env:DB_PATH = "$env:TEMP\verificacion-manual.db"
npm start
```

En otra terminal:

```bash
npm run client:dev
```

Abrir `http://127.0.0.1:5173` y comprobar inventario, disponibilidad, creación de reserva, rechazo de superposición, cancelación e historial. Al terminar, detener ambos servidores y eliminar la base temporal y sus archivos auxiliares, si existen.

Las pruebas automatizadas del cliente cubren la conversión de fechas y la capa HTTP. Los componentes visuales se verificaron manualmente; no se afirma que exista una suite automatizada integral de componentes React.

## Limitaciones

- Aplicación local, sin autenticación ni autorización.
- Sin pagos, notificaciones ni integraciones externas.
- No garantiza concurrencia distribuida ni está diseñada como servicio de producción.
- No se administran altas, bajas ni modificaciones del inventario.
- La interfaz visual se comprueba manualmente; no hay pruebas automatizadas integrales de todos sus componentes.
- Los casos no especificados expresamente se documentan en `PROGRESS.md`.

---

# 3. Preparación del agente

## Entorno y modelo

| Dato | Valor registrado |
|---|---|
| Harness / herramienta | OpenCode |
| Versión | `1.19.3` |
| Proveedor | MiniMax |
| Modelo | MiniMax M3.1 Flash (free) |
| Identificador configurado | `minimax/minimax-m3.1-flash:free` |
| Node.js del entorno registrado | `v24.14.1` |

La información del entorno y las limitaciones de visibilidad se documentan en [`docs/agent-evidence/ENTORNO.md`](docs/agent-evidence/ENTORNO.md). El identificador del modelo figura en `opencode.json`. Se eligió un agente existente con acceso al repositorio y herramientas de edición y ejecución, sin construir un harness propio ni depender de servicios pagos para reproducir la aplicación.

## Instrucciones, contexto y permisos

- `AGENTS.md` contiene las instrucciones persistentes del proyecto y los criterios de trabajo.
- `SPEC.md` proporciona los requisitos funcionales, las reglas de negocio y los criterios de aceptación.
- `PROGRESS.md` conserva el estado, los resultados de verificación y las decisiones.
- `opencode.json` registra la configuración utilizada.
- El contexto se suministró desde los archivos del repositorio y las instrucciones de cada tarea; las evidencias conservan capturas de prompts, resultados y diffs, sin publicar secretos ni credenciales.

La configuración aplicada permitió lectura por defecto, restringió archivos sensibles y bases de datos, y sometió las ediciones y la ejecución de comandos a confirmación según las reglas configuradas. Los cambios se revisaron mediante diffs y verificaciones; la aceptación técnica informada por el agente se distinguió de las comprobaciones humanas.

## Adaptación específica y conservación del progreso

Se definieron reglas explícitas para intervalos semiabiertos, turnos consecutivos, exclusión de reservas canceladas y persistencia sin pérdida del historial. También se configuró `db:reset` para actuar sobre la base de pruebas, advertir antes de borrar y abortar si el destino coincide con la base de desarrollo.

El progreso se conserva en archivos versionados y en Git, por lo que puede recuperarse entre sesiones. La adaptación y sus pruebas están registradas en `AGENTS.md`, `PROGRESS.md`, `SPEC.md`, `src/db/reset.ts` y `tests/persistence.test.ts`.

## Evidencias de uso real

- [Entorno, versión, modelo, permisos y contexto](docs/agent-evidence/ENTORNO.md).
- [Capturas de prompts, respuestas y diffs](docs/agent-evidence/).
- [Capturas de pruebas de API](docs/agent-evidence/).
- [Capturas de verificación humana de la interfaz](docs/agent-evidence/).
- [Registro versionado del progreso](PROGRESS.md).

---

# 4. Registro de decisiones y delegación

## Decisiones técnicas significativas

| Decisión | Motivo | Consecuencia |
|---|---|---|
| TypeScript, Node.js y Fastify para la API | Mantener una API local tipada y verificable | Esquemas y rutas HTTP separados de los servicios |
| SQLite mediante `better-sqlite3` | Persistencia local sencilla, reproducible y sin servicio externo | Reservas recuperables tras reiniciar la aplicación |
| React y Vite como proyecto independiente en `client/` | Ofrecer una interfaz web sin mezclar sus dependencias con las del backend | Instalación separada mediante `npm ci --prefix client` |
| Intervalos semiabiertos `[inicio, fin)` | Permitir turnos consecutivos sin falsos conflictos | La condición de superposición se aplica de forma consistente |
| Consulta de conflictos compartida entre disponibilidad y creación | Evitar diferencias entre lo que informa la consulta y lo que acepta la creación | La regla está centralizada y la comprobación e inserción se protegen con una transacción SQLite |
| UTC para persistencia e `America/Argentina/Buenos_Aires` para la interfaz | Evitar ambigüedades al intercambiar instantes | La API recibe instantes ISO 8601 con zona explícita |
| `DB_PATH` y `TEST_DATABASE_PATH` separados | Proteger las reservas de desarrollo durante las pruebas y el reinicio de datos | `db:reset` advierte y aborta si el destino es la base de desarrollo |
| Un archivo `AGENTS.md` y progreso versionado | Conservar instrucciones y decisiones fuera del historial del chat | El contexto y la evolución pueden revisarse en el repositorio |

El registro más completo, con fechas, alternativas y consecuencias, está en [`PROGRESS.md`](PROGRESS.md). La versión inicial y los cambios significativos pueden recuperarse mediante el historial de Git.

## Episodio 1 — Reglas de reservas

- **Objetivo y requisito:** implementar creación, disponibilidad y cancelación, incluida la validación y el rechazo de superposiciones de reservas activas.
- **Contexto e instrucción:** `SPEC.md` y `AGENTS.md`, con los criterios de aceptación de las reglas de negocio.
- **Acción del agente:** implementación de servicios y repositorios, consulta compartida de conflictos y pruebas de las reglas.
- **Decisión humana:** episodio aceptado tras revisar los cambios y las comprobaciones.
- **Evidencia:** [`docs/episodes/EPISODIO 1.MD`](docs/episodes/EPISODIO%201.MD), pruebas de reservas y registro de progreso.

## Episodio 2 — Contrato de la API REST

- **Objetivo y requisito:** implementar y comprobar los endpoints, esquemas, códigos HTTP y formato de errores definidos en `SPEC.md`.
- **Contexto e instrucción:** contrato de la API, reglas de validación y criterios de aceptación.
- **Acción del agente:** implementación de las rutas y esquemas para inventario, disponibilidad, consulta, creación y cancelación.
- **Decisión humana:** episodio aceptado tras revisar respuestas HTTP, códigos y pruebas.
- **Evidencia:** [`docs/episodes/EPISODIO 2.MD`](docs/episodes/EPISODIO%202.MD), `tests/api.test.ts` y capturas en `docs/agent-evidence/`.

## Episodio 3 — Persistencia

- **Objetivo y requisito:** demostrar que las reservas activas y canceladas sobreviven a un reinicio y que cancelar no elimina el registro ni mantiene ocupado el intervalo.
- **Contexto e instrucción:** requisitos de persistencia e historial de `SPEC.md`, y procedimiento de protección de las bases de datos.
- **Acción del agente:** persistencia en SQLite, estados de reserva y pruebas relacionadas.
- **Decisión humana:** episodio aceptado; se comprobó manualmente el listado antes y después de reiniciar el servidor sin ejecutar `db:reset`.
- **Evidencia:** [`docs/episodes/EPISODIO 3.MD`](docs/episodes/EPISODIO%203.MD), `tests/persistence.test.ts` y resultados finales de `PROGRESS.md`.

## Cierre y trazabilidad

La interfaz React y la documentación se completaron después de los tres episodios. La revisión humana final confirmó los flujos principales de la interfaz y contrastó el README con el código, los scripts y las respuestas observadas. Los resultados de la versión entregada se registran en `PROGRESS.md`; las capturas respaldan el proceso, pero no sustituyen las pruebas automatizadas ni los resultados reproducibles.

La entrega no incluye autenticación, roles reales, notificaciones, pagos, integraciones externas, despliegue obligatorio ni garantías de concurrencia distribuida. La aplicación puede instalarse, ejecutarse y probarse sin una cuenta de modelo.
