# AGENTS.md — Reglas del proyecto

## 1. Contexto del proyecto

Sistema local de reservas de equipos de laboratorio.

- **Entorno:** Node.js 24.
- **Lenguaje:** TypeScript con modo estricto.
- **Backend:** Fastify.
- **Base de datos:** SQLite con `better-sqlite3`.
- **Validación:** `@fastify/type-provider-typebox`.
- **Pruebas:** Vitest.
- **Frontend:** React + Vite + TypeScript en `client/`.
- **Backend y pruebas:** `src/` y `tests/` en la raíz.
- **Agente de programación:** OpenCode.
- **Especificación funcional:** `SPEC.md`.
- **Sistema operativo del desarrollador:** Windows. Los comandos y los scripts de `package.json` deben funcionar en Windows y también en Linux/macOS (sin `rm -rf`, sin `VAR=valor comando`; usar scripts de Node o `cross-env` si hace falta).

La fuente de verdad para los requisitos funcionales y las reglas de negocio es `SPEC.md`. Este archivo establece las instrucciones operativas del agente.



## 2. Proceso de trabajo obligatorio

1. Antes de comenzar cada tarea, leer `SPEC.md` y `PROGRESS.md`.
2. Trabajar de forma incremental, abordando un requisito o una tarea acotada por vez.
3. Escribir primero las pruebas y mostrarlas antes de implementar el código. Si no es posible, decir por qué.
4. No modificar `SPEC.md` ni `data/inventory.json`. Si existe una ambigüedad o contradicción, detenerse y solicitar aclaraciones.
5. No inventar resultados ni afirmar que se ejecutaron comandos, pruebas o verificaciones que no se realizaron realmente.
6. Al finalizar cada tarea, informar los archivos modificados, los comandos ejecutados, sus resultados y los pendientes identificados.
7. Actualizar `PROGRESS.md` con una descripción fiel del trabajo realizado y su estado de verificación.
8. No instalar dependencias, ejecutar comandos destructivos ni realizar cambios importantes de alcance sin aprobación humana previa.
9. Revisar los cambios producidos antes de dar una tarea por terminada.
10. Si una prueba falla, informar el error real. No modificar una prueba únicamente para ocultar un defecto de implementación.
11. No considerar una tarea verificada solo porque el código parece correcto o el agente afirma haberla completado.
12. No introducir funcionalidades fuera del alcance definido en `SPEC.md` sin autorización humana.
13. Hacer un solo cambio acotado por vez. Si la tarea pedida abarca varios módulos, proponer el orden y esperar confirmación.

## 3. Reglas de dominio

- **Intervalos de reserva:** utilizar intervalos semiabiertos `[inicio, fin)`. Una reserva que termina exactamente cuando comienza otra para la misma unidad no genera conflicto.
- **Solapamientos:** existe conflicto cuando `inicio_nuevo < fin_existente && fin_nuevo > inicio_existente`, considerando únicamente reservas `ACTIVE` de la misma unidad.
- **Cancelación:** actualizar el estado a `CANCELLED` y registrar `cancelled_at`. Nunca eliminar físicamente una reserva.
- **Consistencia transaccional:** proteger la comprobación de solapamientos y la inserción de la reserva mediante una única transacción de SQLite.
- **Fechas:** aceptar fechas ISO 8601 con zona horaria explícita. Rechazar con HTTP 400 los valores sin zona. Normalizar a UTC y guardar y devolver como `YYYY-MM-DDTHH:mm:ss.sssZ`. El cuerpo de `POST /reservations` usa `equipmentId`, `requester`, `startAt` y `endAt`; la disponibilidad usa `start` y `end`. Los códigos de error son `VALIDATION_ERROR`, `NOT_FOUND`, `OVERLAP` y `ALREADY_CANCELLED`.
- **Orden de validación:** formato y campos (400), existencia de unidad o reserva (404) y conflictos de reservas (409), de acuerdo con `SPEC.md`.
- **Separación de responsabilidades:** la lógica de negocio reside en los servicios. Las rutas HTTP se encargan de traducir las solicitudes y respuestas.
- **Inicialización:** el inicio normal del servidor nunca debe borrar datos persistidos. La carga inicial del inventario debe ser idempotente.
- **Datos de prueba:** utilizar nombres y datos ficticios para los solicitantes.
- **Frontend:** `client/` solo presenta datos y muestra los mensajes de error de la API. No duplica validaciones de negocio ni la lógica de superposición. Muestra y captura horas en America/Argentina/Buenos_Aires y las envía a la API en UTC.

Si alguna regla de este apartado entra en conflicto con `SPEC.md`, detenerse y solicitar una decisión humana en lugar de modificar unilateralmente cualquiera de los documentos.

## 4. Calidad y seguridad

- Mantener habilitada la comprobación estricta de tipos de TypeScript.
- Evitar `any`, salvo que exista una justificación explícita.
- Utilizar consultas SQL parametrizadas.
- Garantizar la integridad referencial mediante claves foráneas de SQLite.
- Mantener respuestas y errores HTTP consistentes con `SPEC.md`.
- No exponer secretos, credenciales ni información sensible en el repositorio.
- No duplicar reglas de negocio entre endpoints.
- No borrar ni reinicializar datos persistidos durante el inicio normal.
- Mantener los cambios acotados a la tarea solicitada.

## 5. Verificación humana y trazabilidad

- Identificar qué requisito de `SPEC.md` aborda cada tarea.
- Informar qué pruebas se ejecutaron y cuáles fueron sus resultados reales.
- Diferenciar entre pruebas automatizadas, verificaciones manuales y comprobaciones pendientes.
- Solicitar revisión humana antes de aceptar cambios relevantes.
- Mantener un registro verificable de tareas delegadas, decisiones técnicas, resultados y problemas pendientes.
- No marcar un requisito como completado o verificado en `PROGRESS.md` sin evidencia suficiente.
- Si no se pudo ejecutar una prueba, dejar constancia de esa limitación sin afirmar que pasó.
- El agente registra en `PROGRESS.md` las tareas como «implementada, pendiente de verificación humana». Solo el desarrollador las marca como «verificada», tras ejecutar él mismo las pruebas.

## 6. Criterio de finalización

Una tarea solo puede considerarse terminada cuando sus cambios fueron revisados, las verificaciones aplicables se ejecutaron y sus resultados quedaron documentados.

La finalización de una tarea no implica que todo el proyecto esté terminado. El estado general debe reflejar los criterios de aceptación de `SPEC.md` y las verificaciones realmente realizadas.