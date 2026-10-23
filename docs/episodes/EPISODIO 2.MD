## 1.2. Episodio 2 — Implementación y verificación del contrato de la API REST

### Objetivo y requisitos

El objetivo de este episodio fue delegar al agente de programación la revisión, implementación y verificación del contrato de la API REST del sistema de reservas del laboratorio, utilizando esquemas TypeBox y pruebas automatizadas con `fastify.inject`.

La tarea se basó en los requisitos definidos en `SPEC.md`, particularmente en la sección 8, correspondiente a la API REST, y en los criterios de aceptación relacionados con la creación, consulta, disponibilidad y cancelación de reservas.

Los requisitos principales fueron:

- Implementar y verificar los seis endpoints definidos en la especificación: `GET /equipment`, `GET /equipment/:id/availability`, `GET /reservations`, `POST /reservations`, `GET /reservations/:id` y `POST /reservations/:id/cancel`.
- Respetar los esquemas de entrada y salida, los formatos JSON, los códigos HTTP y los códigos de error establecidos en `SPEC.md`.
- Utilizar esquemas TypeBox para declarar y validar el contrato de las rutas.
- Incorporar pruebas automatizadas con `fastify.inject`, incluyendo el ejemplo de reserva de `MIC-01` y la comprobación de que `MIC-01` y `MIC-02` pueden reservarse durante el mismo intervalo.
- Mantener la separación de responsabilidades, delegando las reglas de negocio en los servicios y limitando las rutas al tratamiento de solicitudes y respuestas.
- Verificar la implementación mediante pruebas automatizadas, comprobación de tipos, compilación y solicitudes HTTP contra una instancia del servidor configurada con una base de datos temporal.

### Modelo y contexto suministrado

El episodio se realizó con **MiniMax M3.1 Flash (free)** mediante OpenCode. El agente recibió la especificación del proyecto y las instrucciones generales documentadas en `AGENTS.md`, además de una instrucción específica para implementar y comprobar el contrato de la API REST.

El extracto de la instrucción fue el siguiente:

> Implementá las rutas del SPEC sección 8 con esquemas TypeBox: GET /equipment, GET /equipment/:id/availability, GET /reservations, POST /reservations, GET /reservations/:id, POST /reservations/:id/cancel. Cuerpo, formatos JSON, códigos HTTP y códigos de error exactamente como el SPEC. Pruebas con fastify.inject, incluido el ejemplo MIC-01/MIC-02. Las rutas delegan en los services, sin reglas de negocio.

La instrucción estableció como condiciones principales el cumplimiento estricto del contrato especificado, la incorporación de pruebas automatizadas y el mantenimiento de la separación entre la capa HTTP y la lógica de negocio. Como las rutas ya existían como resultado de las tareas anteriores, el trabajo también comprendió su revisión frente a la especificación y la corrección de los desvíos detectados.

### Acción y resultado del agente

El agente revisó las seis rutas de la API y sus esquemas de entrada y salida. Como resultado, identificó un desvío en el tratamiento del tipo de contenido de las solicitudes de cancelación y completó la declaración de los esquemas de respuesta de error en las rutas.

Los principales cambios fueron los siguientes:

- `src/app.ts`: incorporación de un parser de contenido comodín que descarta el cuerpo de las solicitudes cuando no existe un parser más específico aplicable. Esto permite que `POST /reservations/:id/cancel` no responda con HTTP 415 ante un tipo de contenido no admitido, dado que el endpoint no requiere un cuerpo. Los parsers específicos de Fastify mantienen su prioridad, por lo que `POST /reservations` continúa exigiendo JSON.
- `src/modules/equipment/equipment.routes.ts`: declaración de los esquemas de respuesta de error para los códigos HTTP 400 y 404 mediante `ErrorResponseSchema`.
- `src/modules/reservations/reservations.routes.ts`: declaración de los esquemas de respuesta de error para los códigos HTTP 400, 404 y 409 mediante `ErrorResponseSchema`.
- `tests/api.test.ts`: creación de 37 pruebas de contrato con `fastify.inject`, que cubren los seis endpoints, los formatos de respuesta, los códigos HTTP, los errores y los escenarios de reservas establecidos en la especificación.
- `PROGRESS.md`: actualización del registro de decisiones técnicas, las verificaciones ejecutadas y los pendientes de las tareas relacionadas.

Las pruebas incorporadas incluyeron el ejemplo de `MIC-01` con la solicitante ficticia Ana Ficticia y un intervalo comprendido entre las 10:00 y las 11:00, con zona horaria `-03:00`. También se verificó la creación de una reserva para `MIC-02` durante el mismo intervalo, la detección de superposiciones, la consulta de disponibilidad, la cancelación y el rechazo de una segunda cancelación.

Durante el proceso, OpenCode se congeló y fue necesario interrumpir la ejecución dos veces y volver a enviar el prompt. Finalmente, el agente completó el trabajo y presentó un resumen de los cambios y de las verificaciones realizadas.

Los resultados registrados al finalizar esta etapa fueron los siguientes:

| Comprobación | Resultado |
|---|---|
| `npx vitest run tests/api.test.ts` | 1 archivo de prueba, 37 pruebas aprobadas y 0 fallos. |
| `npm run typecheck` | Finalizó sin diagnósticos. |
| `npm test` | 5 archivos de prueba, 100 pruebas aprobadas, 2 pendientes y 0 fallos. |
| `npm run build` | Finalizó sin errores. |
| `GET /equipment` | HTTP 200; devuelve el inventario como arreglo JSON. |
| `POST /reservations` con el ejemplo de `SPEC.md` | HTTP 201; devuelve la reserva creada con los instantes normalizados a UTC. |
| Reservas simultáneas de `MIC-01` y `MIC-02` | HTTP 201 para ambas reservas durante el mismo intervalo. |
| Creación de una reserva superpuesta | HTTP 409, error `OVERLAP`. |
| Consulta de una reserva inexistente | HTTP 404, error `NOT_FOUND`. |
| Consulta de disponibilidad | HTTP 200, con los campos `available` y `conflicts` correspondientes al intervalo consultado. |
| Cancelación de una reserva | HTTP 200; devuelve la reserva con estado `CANCELLED` y fecha de cancelación informada. |
| Segunda cancelación de la misma reserva | HTTP 409, error `ALREADY_CANCELLED`. |
| Cancelación con un tipo de contenido no admitido | HTTP 200, en lugar del HTTP 415 observado antes de la corrección. |
| Verificación manual de los seis endpoints | El agente informó respuestas acordes con los códigos y cuerpos esperados al ejecutar el servidor compilado sobre una base de datos temporal. |

La verificación manual también contempló solicitudes inválidas, unidades inexistentes y rutas no definidas. Según el registro del agente, la base de datos de desarrollo permaneció con las cinco unidades del inventario, sin reservas y con una única migración registrada; la base y los archivos de registro temporales utilizados durante la prueba se eliminaron al finalizar.

Quedaron pendientes el criterio CA-07, correspondiente a la persistencia después de reiniciar el servidor, y un caso de RF-01 relacionado con la inicialización del inventario. Estos aspectos corresponden a otras tareas del proyecto y no se consideraron completados por las pruebas de este episodio. También quedó documentado que `GET /reservations?equipmentId=` responde HTTP 400 cuando el parámetro está vacío, un caso cuyo comportamiento no está definido expresamente en `SPEC.md`.

### Decisión humana y fundamento

La decisión humana fue **aceptar el resultado técnico de la implementación**.

Esta decisión se fundamenta en los resultados de las pruebas de contrato, la ejecución de la suite completa, la comprobación de tipos y la compilación del proyecto. Las pruebas específicas permiten comprobar el comportamiento de los seis endpoints y verificar que las respuestas observadas respeten el contrato esperado en los escenarios contemplados.

La intervención humana también requiere distinguir entre el trabajo realizado por el agente y la aceptación de la solución. Los resultados informados por OpenCode constituyen evidencia del proceso, pero no equivalen por sí solos a una revisión independiente de todos los requisitos. Por ello, la aceptación definitiva debe vincularse con la revisión del código y con la versión concreta del repositorio que se entregue.

Durante este episodio se adoptaron las siguientes decisiones técnicas, registradas en `PROGRESS.md`:

- Se corrigió el tratamiento del tipo de contenido en el endpoint de cancelación, dado que la especificación no define un cuerpo para esa operación y establece los códigos HTTP esperados. La modificación evita que un tipo de contenido no admitido produzca un HTTP 415 ajeno al contrato definido para ese endpoint.
- Se declararon explícitamente los esquemas de respuesta de error en las rutas, reutilizando `ErrorResponseSchema` para expresar el formato `{ "error": { "code", "message" } }`.
- Se mantuvieron las reglas de negocio en los servicios, sin duplicar en las rutas la comprobación de superposiciones, la validación de intervalos, la cancelación o las operaciones transaccionales.
- Se conservaron como pendientes los casos que pertenecen a otras tareas, evitando considerar completados requisitos que no fueron verificados específicamente en este episodio.

La corrección del tratamiento del tipo de contenido constituye el principal ajuste funcional realizado durante la tarea. No se registran otras correcciones humanas posteriores a la respuesta final del agente, ya que no se dispone de evidencia de que hayan ocurrido.

### Evidencias y trazabilidad

La evidencia de este episodio debe conservarse junto con la versión entregada del repositorio. Los siguientes archivos y comprobaciones permiten reconstruir el trabajo realizado sin necesidad de adjuntar la transcripción completa de la interacción con el agente.

| Evidencia | Ubicación o procedimiento |
|---|---|
| Captura del prompt de la tarea | `docs/agent-evidence/quinto_prompt.png` |
| Resumen respuesta final del agente | `docs/agent-evidence/resumen_respuesta_quinto_prompt.png` |
| Diferencias de código posteriores al prompt | `docs/agent-evidence/git_diff_quinto_prompt.png` |
| Comprobaciones manuales | `docs/agent-evidence/comprobaciones_manuales_quinto_prompt.png`, `docs/pruebas_api_pt1.png` y `docs/agent-evidence/pruebas_api_pt2.png` |
| Pruebas del contrato HTTP | `tests/api.test.ts` |
| Rutas de equipment | `src/modules/equipment/equipment.routes.ts` |
| Rutas de reservas | `src/modules/reservations/reservations.routes.ts` |
| Configuración de Fastify y parser de contenido | `src/app.ts` |
| Registro de decisiones y resultados | `PROGRESS.md`, sección «Tarea 4 — API REST» |
| Verificación automatizada | Ejecución de `npx vitest run tests/api.test.ts`, `npm run typecheck`, `npm test` y `npm run build` |

**Conclusión del episodio.** La delegación permitió revisar el contrato de la API REST, corregir un desvío en el tratamiento de las solicitudes de cancelación y ampliar la cobertura de pruebas automatizadas de los seis endpoints. La intervención humana se centró en establecer los requisitos, delimitar las responsabilidades de las rutas y los servicios, evaluar los resultados informados y mantener explícitos los aspectos pendientes. El episodio evidencia que la contribución del agente debe acompañarse de pruebas verificables, documentación de las decisiones y trazabilidad con la versión entregada del software.