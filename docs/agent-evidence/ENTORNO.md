# Entorno del agente

- **Entorno:** OpenCode.
- **Versión:** 1.19.3.
- **Proveedor del modelo:** Minimax.
- **Modelo seleccionado:** MiniMax M3.1 Flash (free)
- **Identificador técnico:** minimax/minimax-m3.1-flash:free
- **Función:** Agente que edita el repositorio y ejecuta comandos con mi aprobación.
- **Motivo de elección:** Elegí este mode básicamente por ser un modelo gratuito que viene configurado por defecto en Cursor.
- **Permisos:** Ejecución automática de comandos de terminal desactivada; se revisó cada comando antes de ser ejecutado.
- **Contexto suministrado:** `SPEC.md`, `PROGRESS.md` y `AGENTS.md`.
- **Contexto excluido:** (`node_modules`, `*.db`, `.env`)
- **Versión de Node.js:** `v24.14.1`.
