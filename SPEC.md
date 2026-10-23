# SPEC.md — Sistema de reservas de laboratorio

## 1. Objetivo del proyecto

Desarrollar una aplicación local para gestionar las reservas de equipos de un laboratorio, permitiendo consultar la disponibilidad de cada unidad física, crear reservas y cancelarlas sin perder el historial.

La aplicación debe evitar reservas superpuestas para una misma unidad y conservar la información de las reservas después de reiniciar el servidor.

El desarrollo se realizará utilizando OpenCode como agente de programación, TypeScript, Node.js, SQLite y React.

## 2. Alcance

### Incluido

- Consultar el inventario de equipos precargado.
- Consultar la disponibilidad de una unidad para un intervalo determinado.
- Crear reservas de equipos.
- Cancelar reservas existentes.
- Mantener el historial de reservas activas y canceladas.
- Persistir los datos en una base de datos SQLite.
- Validar entradas y reglas de negocio.
- Exponer una API REST local.
- Implementar pruebas automatizadas.
- Interfaz web mínima (React) que consume la API REST local.
- Documentar la instalación, ejecución y verificación del sistema.

### Excluido

- Autenticación y gestión de usuarios reales.
- Roles y permisos.
- Notificaciones por correo o mensajería.
- Pagos.
- Integraciones con servicios externos.
- Administración del inventario.
- Interfaz gráfica compleja.
- Despliegue en producción y concurrencia distribuida.

## 3. Tecnologías

- **Entorno de ejecución:** Node.js: 24 LTS (ver .nvmrc).
- **Lenguaje:** TypeScript con comprobación estricta de tipos.
- **API HTTP:** Fastify.
- **Interfaz:** React + Vite + TypeScript en `client/`, mínima, sin librerías de UI. Consume la API mediante proxy de Vite. No contiene reglas de negocio; solo muestra los errores de la API.
- **Base de datos:** SQLite.
- **Acceso a datos:** better-sqlite3.
- **Validación de esquemas:** @fastify/type-provider-typebox
- **Pruebas:** Vitest.
- **Control de versiones:** Git.
- **Agente de programación:** OpenCode.


Las versiones concretas de las dependencias deberán quedar registradas en `package.json` y en el archivo de bloqueo correspondiente.

No se deben agregar dependencias innecesarias ni sustituir las tecnologías definidas sin justificar el cambio.

## 4. Inventario inicial

El inventario debe cargarse de forma reproducible y contener las siguientes unidades físicas:

| ID | Equipo |
|---|---|
| MIC-01 | Microscopio digital |
| MIC-02 | Microscopio digital |
| OSC-01 | Osciloscopio |
| MUL-01 | Multímetro |
| FUE-01 | Fuente de alimentación |

Cada identificador representa una unidad física independiente. El inventario no debe duplicarse cuando se reinicie la aplicación.

La fuente del inventario es data/inventory.json.

## 5. Requisitos funcionales

### RF-01. Consultar inventario

El sistema debe permitir consultar las unidades disponibles en el inventario inicial.

La consulta no debe modificar los datos almacenados.

### RF-02. Consultar disponibilidad

El sistema debe permitir consultar si una unidad puede reservarse durante un intervalo determinado.

La consulta debe utilizar las mismas reglas de validación y superposición que la creación de reservas.

Una unidad estará disponible cuando no existan reservas activas que se superpongan con el intervalo solicitado.

### RF-03. Crear una reserva

El sistema debe permitir crear una reserva con los siguientes datos:

- Identificador único generado por el sistema.
- Identificador de la unidad reservada.
- Nombre del solicitante ficticio.
- Fecha y hora de inicio.
- Fecha y hora de finalización.
- Estado de la reserva.

Toda reserva nueva debe comenzar en estado `ACTIVE`.

Si la operación es válida, el sistema debe guardar la reserva y devolver su identificador y los datos registrados.

### RF-04. Cancelar una reserva

El sistema debe permitir cancelar una reserva existente.

La cancelación debe cambiar su estado a `CANCELLED`, conservando el identificador y los demás datos originales.

Una reserva cancelada no debe bloquear futuras reservas para el mismo intervalo.

No se debe eliminar físicamente la reserva de la base de datos.

Una reserva ya cancelada no debe poder cancelarse nuevamente como si siguiera activa. En caso de intentarse se debe responder 409 y no modificar datos.

### RF-05. Persistencia

Las reservas y sus estados deben almacenarse en SQLite.

Los datos deben conservarse al detener y reiniciar el servidor. El inventario también debe permanecer disponible sin generar duplicados.

### RF-06. Interfaz web mínima
La interfaz permite listar equipos, consultar disponibilidad, crear una reserva, ver el historial de reservas con su estado y cancelar una reserva. Captura y muestra las horas en la zona America/Argentina/Buenos_Aires (UTC-3) y las envía a la API en UTC.

## 6. Reglas de negocio

### RN-01. Identificación de unidades

Solo se pueden reservar unidades existentes en el inventario.

El orden de validación es: formato y campos (400) → existencia de unidad o reserva (404) → conflicto de superposición (409). Una unidad inexistente en POST /reservations o en la consulta de disponibilidad responde 404.

### RN-02. Solicitante

El solicitante debe ser una cadena no vacía y no puede contener únicamente espacios en blanco.

Se recorta (trim) antes de guardar y tiene un máximo de 80 caracteres.

### RN-03. Intervalo temporal

La fecha y hora de inicio deben ser estrictamente anteriores a la fecha y hora de finalización.

Los valores temporales deben validarse antes de ejecutar operaciones sobre la base de datos.

### RN-04. Prevención de superposiciones

No se permiten reservas activas superpuestas para una misma unidad.

Dos intervalos se consideran superpuestos cuando:

`inicio_nuevo < fin_existente AND fin_nuevo > inicio_existente`

Los límites consecutivos están permitidos.

Por ejemplo, una reserva de 10:00 a 11:00 permite otra reserva para la misma unidad de 11:00 a 12:00.

### RN-05. Independencia entre unidades

Dos unidades físicas distintas pueden reservarse simultáneamente, aunque sean del mismo tipo de equipo.

### RN-06. Reservas canceladas

Las reservas canceladas no deben participar en la comprobación de superposiciones.

### RN-07. Consistencia

La comprobación de disponibilidad y la creación de reservas deben utilizar una lógica coherente.

La operación de creación debe proteger la comprobación y la escritura frente a inconsistencias locales, utilizando una transacción de SQLite cuando corresponda.

### RN-08. Política temporal

- Las fechas se reciben en ISO 8601 con zona explícita (`Z` o desplazamiento, p. ej. `2026-11-02T10:00:00-03:00`). Un valor sin zona se rechaza con 400.
- Se normalizan a UTC y se guardan y devuelven como `YYYY-MM-DDTHH:mm:ss.sssZ`.
- Se permiten reservas en el pasado (decisión documentada); el dominio no depende del reloj y las pruebas usan fechas fijas.
- No se imponen límites de duración ni de anticipación (decisión documentada).

## 7. Modelo de datos

### Tabla `equipment`

- `id`: identificador de la unidad, clave primaria.
- `name`: nombre del equipo, obligatorio.

### Tabla `reservations`

- `id`: identificador único de la reserva.
- `equipment_id`: referencia a la unidad reservada.
- `requester`: nombre del solicitante.
- `start_at`: fecha y hora de inicio.
- `end_at`: fecha y hora de finalización.
- `status`: `ACTIVE` o `CANCELLED`.
- `created_at`: fecha y hora de creación.
- `cancelled_at`: fecha y hora de cancelación, nula si está activa.

La relación entre reservas y equipos debe garantizar la integridad referencial.

Las cancelaciones deben actualizar el estado de la reserva, no eliminar el registro.

La inicialización de la base de datos debe ser idempotente: ejecutarla más de una vez no debe duplicar el inventario ni borrar las reservas existentes.

## 8. API REST

Los endpoints mínimos serán:

| Método | Endpoint | Propósito |
|---|---|---|
| GET | `/equipment` | Consultar inventario |
| GET | `/equipment/:id/availability?start=...&end=...` | Consultar disponibilidad |
| GET | `/reservations?equipmentId=...` | Listar reservas (activas y canceladas) |
| POST | `/reservations` | Crear una reserva |
| GET | `/reservations/:id` | Consultar una reserva |
| POST | `/reservations/:id/cancel` | Cancelar una reserva |

Los endpoints deben devolver respuestas JSON consistentes.

Códigos HTTP esperados:

- `200`: operación de consulta o cancelación exitosa.
- `201`: reserva creada.
- `400`: entrada inválida.
- `404`: unidad o reserva inexistente.
- `409`: conflicto con una reserva activa.

Los errores deben incluir un mensaje comprensible y no exponer información interna innecesaria.

Códigos de error en el cuerpo: `VALIDATION_ERROR` (400), `NOT_FOUND` (404), `OVERLAP` (409).

### Cuerpo de POST /reservations
```json
{ "equipmentId": "MIC-01", "requester": "Ana Ficticia",
  "startAt": "2026-11-02T10:00:00-03:00", "endAt": "2026-11-02T11:00:00-03:00" }
```
La disponibilidad usa los parámetros de consulta `start` y `end` con el mismo formato.

### Formato de respuestas (JSON):
Reserva:
```json
{ "id": "uuid", "equipmentId": "MIC-01", "requester": "Ana Ficticia",
  "startAt": "2026-11-02T13:00:00.000Z", "endAt": "2026-11-02T14:00:00.000Z",
  "status": "ACTIVE", "createdAt": "...", "cancelledAt": null }
```
Disponibilidad: `{ "equipmentId": "MIC-01", "start": "...", "end": "...", "available": false, "conflicts": ["<id>"] }`

Error: `{ "error": { "code": "OVERLAP", "message": "..." } }`

## 9. Arquitectura y organización

Separar las responsabilidades para evitar que las rutas HTTP contengan toda la lógica de negocio.

Estructura orientativa:

```text
src/
  app.ts
  server.ts
  config/
  db/
    database.ts
    migrations/
    seed.ts
  modules/
    equipment/
      equipment.routes.ts
      equipment.service.ts
      equipment.repository.ts
    reservations/
      reservations.routes.ts
      reservations.service.ts
      reservations.repository.ts
  schemas/
  errors/
tests/
  equipment.test.ts
  reservations.test.ts
  persistence.test.ts
```

La estructura puede ajustarse durante la implementación, siempre que se mantenga una separación clara entre transporte HTTP, reglas de negocio y persistencia.

## 10. Requisitos de calidad

- Activar `strict` en TypeScript.
- Evitar el uso de `any` salvo justificación.
- Utilizar consultas parametrizadas.
- Mantener habilitadas las claves foráneas de SQLite.
- No duplicar reglas de negocio entre endpoints.
- Manejar errores de forma consistente.
- No almacenar secretos en el repositorio.
- No borrar datos persistidos al iniciar el servidor.
- Mantener las dependencias y los scripts documentados.
- No implementar funcionalidades fuera del alcance sin una razón explícita.

## 11. Pruebas y criterios de aceptación

### CA-01. Creación válida

Una solicitud con unidad existente, solicitante válido e intervalo correcto crea una reserva activa y persistida.

### CA-02. Rechazo de superposición

Si MIC-01 tiene una reserva de 10:00 a 11:00, una reserva de 10:30 a 11:30 para MIC-01 debe rechazarse con un conflicto.

### CA-03. Límites consecutivos

Si MIC-01 tiene una reserva de 10:00 a 11:00, una reserva de 11:00 a 12:00 debe aceptarse.

### CA-04. Unidades diferentes

Una reserva para MIC-02 de 10:00 a 11:00 debe aceptarse aunque MIC-01 tenga una reserva durante ese mismo intervalo.

### CA-05. Entradas inválidas

El sistema debe rechazar, como mínimo:

- Una unidad inexistente.
- Un solicitante vacío o compuesto solo por espacios.
- Fechas u horas inválidas.
- Un inicio igual o posterior al fin.
- Parámetros temporales faltantes o mal formados.

### CA-06. Cancelación e historial

Cancelar una reserva debe conservar sus datos y cambiar su estado a `CANCELLED`. Una nueva reserva para el intervalo liberado debe poder crearse.

### CA-07. Persistencia

Después de detener y reiniciar el servidor, las reservas activas deben seguir bloqueando sus intervalos y las canceladas deben conservar su estado sin bloquearlos.

### CA-08. Disponibilidad

La consulta de disponibilidad debe producir resultados coherentes con las reglas utilizadas al crear una reserva.

### CA-09. Reproducibilidad

Las pruebas y la aplicación deben poder ejecutarse localmente con las dependencias instaladas, sin requerir una cuenta del agente de programación ni servicios externos para el funcionamiento normal del sistema.

El entorno de desarrollo asistido por IA puede requerir la configuración de un proveedor de modelos, pero esta dependencia no debe trasladarse a la ejecución de la aplicación.

Todas las pruebas deben ejecutarse y sus resultados deben registrarse. No se considerará verificada una funcionalidad únicamente porque el agente afirme haberla implementado.

## 12. Comandos y documentación

El proyecto debe proporcionar comandos documentados para:

- Instalar dependencias.
- Inicializar o migrar la base de datos.
- Cargar el inventario inicial.
- Ejecutar el servidor en desarrollo.
- Compilar TypeScript.
- Ejecutar las pruebas.
- Verificar tipos.
- Reiniciar el entorno de prueba sin afectar los datos de desarrollo.

El `README.md` debe explicar los requisitos previos, las versiones utilizadas, la ubicación de la base de datos, ejemplos de solicitudes y respuestas, y el procedimiento de verificación.

## 13. Restricciones para el agente

- Leer esta especificación antes de modificar el proyecto.
- Implementar los requisitos de forma incremental.
- No inventar resultados de pruebas ni afirmar que se ejecutaron comandos que no se ejecutaron.
- No cambiar reglas de negocio sin documentar el motivo.
- No eliminar datos persistidos durante el inicio normal.
- Revisar los cambios y ejecutar las pruebas antes de dar por terminada una tarea.
- Mantener un registro versionado de decisiones, instrucciones relevantes y episodios de delegación.
- Solicitar aprobación humana antes de realizar acciones destructivas o cambios importantes de alcance.
- Informar los requisitos implementados, las pruebas ejecutadas, sus resultados y los pendientes reales.

## 14. Definición de terminado

El proyecto se considera terminado cuando los requisitos funcionales están implementados, las pruebas automáticas requeridas pasan, la persistencia se verifica tras un reinicio, la aplicación puede reproducirse desde un entorno limpio y la documentación permite comprender y comprobar el resultado sin depender del agente de programación.
