
## 1.1. Episodio 1 — Implementación y verificación de las reglas de reservas

### Objetivo y requisitos

El objetivo de este episodio fue delegar al agente de programación la implementación de las reglas de negocio correspondientes a la creación, consulta de disponibilidad y cancelación de reservas del sistema de laboratorio, utilizando desarrollo guiado por pruebas (*Test-Driven Development*, TDD).

La tarea se basó en los requisitos definidos en `SPEC.md`, particularmente en la sección 5 (RF-02, RF-03 y RF-04), la sección 6 (RN-01 a RN-08) y la sección 11 (CA-01 a CA-08).

Los requisitos principales fueron:

- Crear reservas válidas y rechazar aquellas que incumplieran las reglas de negocio.
- Evitar superposiciones de reservas para una misma unidad, permitiendo intervalos consecutivos y reservas simultáneas de unidades diferentes.
- Validar los datos del solicitante, el orden temporal del intervalo y el formato de las fechas, exigiendo zona horaria explícita.
- Mantener la coherencia entre la creación de reservas y la consulta de disponibilidad.
- Cancelar reservas sin eliminar sus registros, conservar sus datos originales y rechazar una segunda cancelación con HTTP 409.
- Garantizar que la comprobación de disponibilidad y la inserción de una reserva se ejecutaran dentro de una transacción.

### Modelo y contexto suministrado

El episodio se realizó con **MiniMax M3.1 Flash (free)** mediante OpenCode. El agente recibió la especificación del proyecto y las instrucciones generales documentadas en `AGENTS.md`, además de una instrucción específica para implementar la lógica de reservas.

El extracto de la instrucción fue el siguiente:

> Implementá reservations.service y reservations.repository con TDD, según SPEC.md  sección 5, 6 y 11. Escribí primero tests Vitest para CA-01 a CA-06 y CA-08: creación válida, superposición (10:30-11:30 sobre 10:00-11:00), límites consecutivos (11:00-12:00), MIC-02 simultáneo, solicitante vacío o solo espacios, fecha inválida, fecha sin zona, inicio >= fin, unidad inexistente, cancelación que conserva datos y libera el horario, cancelar dos veces (409). Luego el código con una transacción para chequeo + insert. Mostrame los tests antes del código.

La instrucción estableció dos condiciones relevantes para la delegación: utilizar los criterios de aceptación existentes como referencia y presentar las pruebas antes de implementar la solución. También delimitó el alcance de la tarea, sin modificar la especificación ni el inventario del proyecto.

### Acción y resultado del agente

El agente trabajó sobre los servicios y repositorios de reservas, las rutas HTTP, la validación de fechas y los archivos de pruebas. Entre los principales cambios se encontraron:

- `src/modules/reservations/reservations.service.ts`: implementación de las operaciones de creación, consulta, listado y cancelación de reservas.
- `src/modules/reservations/reservations.repository.ts`: consultas de persistencia, detección de conflictos, inserción, cancelación y soporte para transacciones.
- `src/modules/equipment/equipment.service.ts`: utilización del mismo criterio de detección de conflictos para consultar la disponibilidad.
- `src/shared/iso-date.ts`: validación de instantes ISO 8601 y normalización de fechas a UTC.
- `tests/reservations.test.ts`, `tests/reservations.service.test.ts` y `tests/equipment.test.ts`: pruebas de integración HTTP, pruebas de servicios y pruebas de disponibilidad.
- `tests/helpers/reservations.ts` y `tests/helpers/test-app.ts`: utilidades compartidas para preparar las pruebas y las bases de datos de prueba.

El proceso de TDD incluyó una fase inicial en la que se ejecutaron las pruebas antes de completar la implementación. En esa ejecución, tres archivos de prueba fallaron, con 38 pruebas fallidas y 10 aprobadas, además de un caso pendiente. Posteriormente, se implementó la lógica necesaria y se volvieron a ejecutar las comprobaciones.

Los resultados registrados al finalizar esta etapa fueron los siguientes:

| Comprobación | Resultado |
|---|---|
| `npm run typecheck` | Finalizó sin errores. |
| `npm test` | 4 archivos de prueba, 63 pruebas aprobadas, 2 pendientes y 0 fallos. |
| `npm run build` | Finalizó sin errores y generó `dist/`. |
| Creación de una reserva válida | HTTP 201. |
| Creación de una reserva superpuesta | HTTP 409, error `OVERLAP`. |
| Consulta de disponibilidad de un intervalo ocupado | HTTP 200, `available: false`. |
| Consulta de disponibilidad de un intervalo libre | HTTP 200, `available: true`. |
| Cancelación de una reserva | HTTP 200; el registro se conserva con estado `CANCELLED`. |
| Segunda cancelación de la misma reserva | HTTP 409, error `ALREADY_CANCELLED`. |
| Reutilización del intervalo de una reserva cancelada | HTTP 201. |

Las pruebas también contemplaron fechas inexistentes, intervalos inválidos y unidades inexistentes. Los casos pendientes correspondían a la persistencia después de reiniciar el servidor y a un requisito de otra tarea, por lo que no se consideraron completados en este episodio.

### Decisión humana y fundamento

La decisión humana fue **aceptar el resultado técnico de la implementación.**.

Esta decisión se fundamentó en la ejecución satisfactoria de las pruebas automatizadas, la comprobación de los tipos de TypeScript, la generación del proyecto y los resultados observados mediante solicitudes HTTP. Estas evidencias respaldaron el funcionamiento de las operaciones principales, pero no sustituyeron la revisión humana de todos los requisitos.

Durante el proceso también se tomaron decisiones específicas:

- Se mantuvo la validación de fechas en la capa de negocio, porque comprobar únicamente el patrón textual no garantiza que la fecha exista en el calendario.
- Se utilizó una consulta común para detectar superposiciones, evitando que la creación y la disponibilidad aplicaran criterios diferentes.
- Se mantuvo la comprobación de conflictos y la inserción dentro de una transacción, de acuerdo con RN-07.
- Se conservó el comportamiento HTTP 415 ante determinados tipos de contenido no admitidos en la solicitud de cancelación. Se decidió no modificarlo hasta evaluar el contrato de la siguiente tarea.
- Se corrigieron las pruebas de servicio para adecuarlas a la interfaz real del helper de base de datos. Esta adaptación se realizó durante el desarrollo y no debe interpretarse como un defecto funcional confirmado de la solución final.

Asimismo, durante una comprobación inicial el agente utilizó por error la base de datos de desarrollo en lugar de una base temporal, lo que generó dos reservas ficticias. Se autorizó su eliminación y se comprobó posteriormente que la base de desarrollo conservaba las cinco unidades del inventario y no contenía reservas. Esta incidencia se documentó para mantener la trazabilidad del proceso.

### Evidencias y trazabilidad

La evidencia de este episodio debe conservarse junto con la versión entregada del repositorio. Los siguientes archivos y comprobaciones permiten reconstruir el proceso sin necesidad de adjuntar la transcripción completa de la interacción con el agente:

| Evidencia | Ubicación o procedimiento |
|---|---|
| Instrucción y respuesta iniciales | `docs/agent-evidence/cuarto_prompt.png.png` |
| Git diff luego de completar la instucción | `docs/agent-evidence/git_diff_cuarto_prompt.png` |
| Pruebas de reservas | `tests/reservations.test.ts` y `tests/reservations.service.test.ts`. |
| Pruebas de disponibilidad | `tests/equipment.test.ts`. |
| Implementación | `src/modules/reservations/`, `src/modules/equipment/` y `src/shared/iso-date.ts`. |
| Verificación automatizada | Ejecución de `npm run typecheck`, `npm test` y `npm run build`. |
| Verificación manual | `docs/agent-evidence/comprobaciones_manuales_cuarto_prompt.png` y revisión de la trazabilidad entre el código generado y la documentación |

**Conclusión del episodio.** La delegación permitió implementar las principales reglas de reservas y obtener resultados verificables mediante pruebas automatizadas y solicitudes HTTP. La intervención humana se concentró en establecer las restricciones, revisar decisiones técnicas, autorizar una operación de limpieza y delimitar los aspectos que debían permanecer pendientes. El episodio muestra que la producción de código por parte del agente no equivale por sí sola a la aceptación definitiva de la solución.