### Episodio 3 — Verificación de la persistencia de reservas mediante pruebas automatizadas

**Modelo:** MiniMax M3.1 Flash (free), ejecutado mediante OpenCode.

**Objetivo y requisito**

Implementar pruebas automatizadas para verificar que las reservas persisten después de cerrar y reabrir la aplicación utilizando el mismo archivo de base de datos SQLite. El episodio se vincula con el requisito CA-07 de `SPEC.md` sección 11 y con RF-05, relativo a la conservación de los datos entre reinicios. También contempla RF-04 y RN-06, ya que las reservas canceladas deben conservar su estado y sus datos sin continuar bloqueando el intervalo, mientras que las reservas activas deben seguir impidiendo nuevas reservas superpuestas.

**Contexto suministrado e instrucción (extracto)**

Se indicó al agente que utilizara una base de datos en un archivo temporal y comprobara el comportamiento de las reservas después de cerrar y reabrir la aplicación y la conexión con SQLite.

> Agregá `tests/persistence.test.ts` con una base en archivo temporal, crear una reserva activa y otra cancelada, cerrar la app y la conexión, reabrir con el mismo archivo y verificar que la activa sigue bloqueando su intervalo y la cancelada conserva su estado sin bloquear.

**Acción y resultado del agente**

El agente modificó `tests/persistence.test.ts` y `tests/helpers/test-app.ts` para permitir construir la aplicación de prueba sobre una conexión SQLite abierta a un archivo temporal y reutilizar ese contexto en las pruebas existentes.

Se incorporaron dos pruebas reales:

- **CA-07 — Persistencia de reservas:** crea una reserva activa y otra que luego cancela; cierra la aplicación y la conexión; vuelve a abrir el mismo archivo y verifica que ambas reservas conservan sus datos y estados. También comprueba, mediante la API, que la reserva activa continúa bloqueando el intervalo, que la cancelada no lo bloquea, que la fila cancelada sigue almacenada y que el intervalo liberado admite una nueva reserva.
- **RF-01 — Inventario sin duplicados tras reiniciar:** verifica que la reinicialización de la base mantiene las cinco unidades del inventario sin duplicarlas y conserva la reserva activa.

Durante la comprobación, el agente ejecutó un control negativo: al configurar deliberadamente la segunda apertura para utilizar una base en memoria (`:memory:`) en lugar del archivo temporal, la prueba falló porque no encontró las dos reservas persistidas. Tras restaurar la apertura del archivo original, la prueba volvió a pasar.

Las verificaciones finales informadas fueron satisfactorias:

- `npm run typecheck`: sin errores.
- `npx vitest run tests/persistence.test.ts`: 15 pruebas aprobadas, sin fallos.
- `npm test`: 5 archivos de prueba, 102 pruebas aprobadas, 0 pendientes y 0 fallos.
- `npm run build`: finalizó sin errores.
- Inspección de `data/reservas.db`: cinco unidades y cero reservas, sin que la suite de pruebas modificara los datos de desarrollo.

**Decisión humana**

Aceptar la respuesta del agente. Se revisaron los cambios realizados en los archivos, las evidencias disponibles y los resultados de las verificaciones automatizadas. Se confirmó que las pruebas cubren la persistencia de las reservas activas y canceladas después de cerrar y reabrir la conexión con el mismo archivo SQLite, así como la conservación del inventario sin duplicados tras reinicializar la base de datos.

Los resultados de `npm run typecheck`, `npm test` y `npm run build` fueron satisfactorios. Asimismo, se comprobó que las pruebas utilizan una base temporal y no modifican los datos de desarrollo. Por lo tanto, se aceptó la implementación del episodio.

**Evidencias**

- `tests/persistence.test.ts`: pruebas de CA-07 y RF-01.
- `tests/helpers/test-app.ts`: creación del contexto de prueba con una conexión SQLite existente.
- `tests/equipment.test.ts`: eliminación del caso pendiente de RF-01, cubierto por la prueba de persistencia.
- Salidas de `npm run typecheck`, `npx vitest run tests/persistence.test.ts`, `npm test` y `npm run build`.
- Capturas disponibles en `docs/agent-evidence/`:
  - `sexto_prompt.png`
  - `resumen_respuesta_sexto_prompt.png`
  - `git_diff_sexto_prompt.png`
  - `comprobaciones_manuales_sexto_prompt.png`
  - `pruebas_api_pt1.png`
  - `pruebas_api_pt2.png`

**Conclusión**

El episodio permitió convertir el criterio de persistencia en pruebas automatizadas reproducibles sobre un archivo SQLite temporal. Además de comprobar la conservación de reservas activas y canceladas, se verificó que el inventario no se duplica tras reinicializar la base. Las pruebas finales informadas no presentaron fallos y la base de desarrollo permaneció sin reservas. 