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
| Planes, capacidades y límites | Faltante | — | Paso 2 |
| Suscripciones y vencimientos | Faltante | — | Paso 3 |
| Panel central de Growth Labs | Faltante | Altas solo por consola (`scripts/crear-taller.js`) | Paso 4 |
| Exportación con archivos | Parcial | JSON/CSV de datos, sin archivos | Paso 6 |
| Respaldo por taller | Parcial | Respaldo global de la base | Paso 6 |

## Pasos

1. ~~Identidad configurable por taller.~~ Hecho: tokens de marca separados del rojo semántico, seis paletas y colores propios validados por contraste en servidor, vista previa claro/oscuro sin afectar lo guardado, restauración a la marca del producto, documentos con copia fija.
2. **Planes y capacidades.** Definición centralizada y versionada; límites aplicados en el servidor, también ante solicitudes simultáneas; distintos de los permisos del usuario. Bajar de plan no borra datos.
3. **Suscripciones manuales auditadas.** Estados `trialing`, `active`, `past_due`, `suspended`, `canceled` con fechas explícitas; evaluación de vencimientos sin depender de abrir una pantalla. Separado de la contabilidad del taller.
4. **Panel central de Growth Labs.** Autenticación propia, permisos mínimos, auditoría. Altas retomables con invitación segura, sin claves ni enlaces en logs.
5. **Cobro recurrente.** Integración independiente con verificación del proveedor, idempotencia, eventos atrasados y conciliación. Nunca activar por el retorno del navegador.
6. **Operación.** Restauración aislada de un solo taller, exportación completa con archivos, cuotas de almacenamiento, monitoreo, y medición de carga antes de fijar cuántos talleres admite una instalación.
7. **Piloto** con talleres autorizados, y recién después lanzamiento comercial con funciones verificadas.

## Riesgos conocidos

- La cascada CSS tiene diez hojas. Los usos de marca y de error ya están separados (`--marca*` / `--red*`); quedan colores literales neutros en algunas hojas.
- En la barra móvil a 360 px un nombre largo se corta con puntos suspensivos («Taller Mecán…»). El nombre completo está en el título y en la etiqueta accesible; un nombre corto configurable resolvería el caso.
- `.impeccable/design.json` describe todavía el rojo anterior; regenerarlo desde el código con `impeccable document`.
- Una persona no puede pertenecer a varios talleres (email único global). Ampliación aditiva solo si se valida la necesidad.
- `resumenVisita` carga la visita completa con varias consultas: medir con volumen real antes de optimizar.
