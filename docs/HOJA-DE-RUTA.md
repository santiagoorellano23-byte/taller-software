# Hoja de ruta técnica

Estado al 11/11/2026, versión 0.1.0. Ordenada por dependencias. Cada paso: prueba de regresión primero, implementación mínima, suite completa, revisión visual si toca la interfaz y commit propio. Un paso no se da por hecho sin evidencia.

## Lo que ya existe (verificado en la base)

| Área | Dónde | Estado |
|---|---|---|
| Alta de talleres | `server/plataforma.js`, `scripts/crear-taller.js` | Funciona por consola |
| Aislamiento | `taller_id`, claves compuestas, `test/talleres.test.js` | Probado con dos talleres; extender a cada módulo nuevo |
| Accesos y roles | `auth.js`, `permisos.js`, `routes/sesion.js` | Dueño, recepción, mecánico; email único global |
| Nombre, perfil, logo | `routes/taller.js`, `marcaHTML` en `public/js/app.js` | Configurable por taller |
| Documentos | `routes/documentos.js` | Copias históricas y enlaces con vencimiento |
| Exportación | `routes/taller.js` | JSON/CSV de datos; no incluye archivos |
| Respaldo y restauración | `server/respaldo.js`, scripts | Global (toda la base) |
| Colores por taller | — | No existe |
| Planes, suscripciones, cuotas | — | No existe |
| Panel de Growth Labs | — | No existe |

## Pasos

1. **Identidad configurable por taller.** Separar tokens de marca (acción, acento) de los semánticos (error, deuda, destructivo, estados). Paletas validadas por contraste en claro y oscuro, persistidas y validadas en el servidor, con vista previa. Los documentos emitidos conservan la identidad con que se emitieron. Probar tres talleres, 390 y 1440 px, datos largos y logos distintos.
2. **Planes versionados y suscripciones manuales auditadas.** Estados `trialing`, `active`, `past_due`, `suspended`, `canceled` con fechas explícitas de gracia. Separado de la contabilidad del taller. El acceso no se habilita desde el frontend.
3. **Capacidades y cuotas en el servidor.** Matriz por plan, distinta de los permisos del usuario. Bajar de plan no borra datos; vencer deja lectura y exportación.
4. **Panel central de Growth Labs.** Autenticación propia, permisos mínimos, auditoría. Altas con invitación segura, sin claves ni enlaces en logs.
5. **Cobro recurrente.** Integración independiente con verificación del proveedor, idempotencia, eventos atrasados y conciliación. Nunca activar por el retorno del navegador.
6. **Operación.** Restauración aislada de un solo taller, exportación completa con archivos, cuotas de almacenamiento, monitoreo, y medición de carga antes de fijar cuántos talleres admite una instalación.
7. **Piloto** con talleres autorizados, y recién después lanzamiento comercial con funciones verificadas.

## Riesgos conocidos

- La cascada CSS tiene diez hojas; el color de acción y el rojo de error comparten variable (`--red`) y hay colores literales. Separarlos es parte del paso 1 y requiere regresión visual.
- `marcaHTML` (`public/js/app.js`) muestra sin logo solo la primera palabra del nombre en la barra móvil: «Taller Modelo» se ve como «TALLER». Con nombres genéricos («Taller…», «Mecánica…») el taller no se reconoce. Resolver en el paso 1 (nombre corto configurable o recorte inteligente) con prueba de nombres largos.
- La marca del producto en el ingreso reutiliza el trazo rojo inclinado y la tipografía de la base original. Es provisoria hasta definir la identidad de Growth Labs Talleres.
- Una persona no puede pertenecer a varios talleres (email único global). Ampliación aditiva solo si se valida la necesidad.
- `resumenVisita` carga la visita completa con varias consultas: medir con volumen real antes de optimizar.
