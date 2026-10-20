# Progreso y decisiones

## Estado
- [ ] 1 Andamiaje  
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

## Evidencias de uso del agente
- Captura del modelo seleccionado en OpenCode: `docs/agent-evidence/Evidencia de la versión de opencode y del modelo seleccionado.png`
- Captura de del primer prompt con su respuesta: `docs/agent-evidence/Captura del primer prompt.png`
- Git diff luego del primer prompt: `docs\agent-evidence\Captura de git diff luego del primer prompt.png`

## Verificaciones ejecutadas por mí
| Comando o verificación | Versión | Resultado real |
|---|---|---|
| Selección del modelo en OpenCode | OpenCode 1.19.3; MiniMax M3.1 Flash (free) | Modelo seleccionado correctamente |
| Configuración de permisos | OpenCode 1.19.3 | Modo lectura configurado correctamente|
| Prueba: lectura de `SPEC.md` y reglas del proyecto | OpenCode 1.19.3; MiniMax M3.1 Flash (free) | Ejecutada; respuesta obtenida: resumen de las reglas del proyecto, sin modificaciones de los archivos |