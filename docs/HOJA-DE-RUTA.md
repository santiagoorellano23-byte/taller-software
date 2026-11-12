# Hoja de ruta técnica

Estado al 12/11/2026, versión 0.1.0. Ordenada por dependencias. Cada paso: prueba de regresión primero, implementación mínima, suite completa, revisión visual si toca la interfaz y commit propio. Un paso no se da por hecho sin evidencia.

## Estado comprobado

| Requisito | Estado | Evidencia | Trabajo pendiente |
|---|---|---|---|
| Aislamiento entre talleres | Verificado | `test/aislamiento.test.js` (14 relaciones cruzadas, exportación, `taller_id` del navegador ignorado), `test/talleres.test.js` | Agregar el caso de cada módulo nuevo |
| Roles y acceso revocado | Verificado | `test/aislamiento.test.js`: mecánico sin administración por API; desactivar corta la sesión abierta | — |
| Identidad: nombre, contacto, logo | Verificado | `routes/taller.js`; logo validado por firma real del archivo (`test/identidad.test.js`) | — |
| Identidad: colores | Verificado | `public/js/marca.js`, `PUT /api/taller/apariencia`, Ajustes → Logo y colores, `test/identidad.test.js`; revisado a 360 y 1440 px, claro y oscuro | — |
| Documentos históricos | Verificado | El color y el logo se copian al emitir; un documento sin color copiado conserva el rojo original | — |
| Planes, capacidades y límites | Verificado (valores de prueba) | `server/planes.js`, `test/servicio.test.js`: módulo no contratado bloqueado por API, datos conservados al bajar de plan, cupo de usuarios con altas simultáneas | Definir cupos y precios reales (decisión comercial) |
| Suscripciones y vencimientos | Verificado | Estados por fecha con reloj fijo, gracia, suspensión, cancelación al cierre, proceso idempotente, conciliación manual | Integración de pago recurrente (paso 5) |
| Panel central de Growth Labs | Verificado | `/plataforma`, `routes/plataforma.js`: un dueño de taller recibe 401 en todas sus rutas; alta retomable; registro con autor; revisado en navegador | Autenticación reforzada (segundo factor) antes de producción |
| Exportación con archivos | Parcial | JSON/CSV de datos, sin archivos | Paso 6 |
| Respaldo por taller | Parcial | Respaldo global de la base | Paso 6 |

## Pasos

1. ~~Identidad configurable por taller.~~ Hecho: tokens de marca separados del rojo semántico, seis paletas y colores propios validados por contraste en servidor, vista previa claro/oscuro sin afectar lo guardado, restauración a la marca del producto, documentos con copia fija.
2. ~~Planes y capacidades.~~ Hecho con valores de prueba (ver DECISIONES 19 y 21).
3. ~~Suscripciones manuales auditadas.~~ Hecho (DECISIONES 20 y 22).
4. ~~Panel central de Growth Labs.~~ Hecho (DECISIONES 23). Pendiente: segundo factor para las cuentas del panel y más de un nivel de permiso si el equipo crece.
5. **Cobro recurrente.** Integración independiente con verificación del proveedor, idempotencia, eventos atrasados y conciliación. Nunca activar por el retorno del navegador.
6. **Operación.** Restauración aislada de un solo taller, exportación completa con archivos, cuotas de almacenamiento, monitoreo, y medición de carga antes de fijar cuántos talleres admite una instalación.
7. **Piloto** con talleres autorizados, y recién después lanzamiento comercial con funciones verificadas.

## Riesgos conocidos

- La cascada CSS tiene diez hojas. Los usos de marca y de error ya están separados (`--marca*` / `--red*`); quedan colores literales neutros en algunas hojas.
- En la barra móvil a 360 px un nombre largo se corta con puntos suspensivos («Taller Mecán…»). El nombre completo está en el título y en la etiqueta accesible; un nombre corto configurable resolvería el caso.
- `.impeccable/design.json` describe todavía el rojo anterior; regenerarlo desde el código con `impeccable document`.
- Una persona no puede pertenecer a varios talleres (email único global). Ampliación aditiva solo si se valida la necesidad.
- `resumenVisita` carga la visita completa con varias consultas: medir con volumen real antes de optimizar.
