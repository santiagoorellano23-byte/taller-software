# Decisiones técnicas

Heredadas de la base operativa original y vigentes en Growth Labs Talleres 0.1.0. Todas son reversibles si la evidencia lo justifica.

1. **Node.js 24 + SQLite integrado (`node:sqlite`), sin dependencias.** Un archivo de base por instalación; los talleres comparten la base y se separan por `taller_id` con claves compuestas que la propia base hace cumplir. Si el volumen medido lo exige, el esquema se puede pasar a PostgreSQL.
2. **Interfaz sin compilación** (HTML, CSS y módulos de JavaScript). Simple de mantener y desplegar.
3. **Sesiones de servidor con cookie HttpOnly + cabecera propia (`X-Talleres`)** contra solicitudes de otros sitios. Contraseñas con scrypt. Sin proveedor de correo: invitaciones y recuperaciones son enlaces de un solo uso que el dueño entrega por un medio seguro.
4. **Permisos por acción en el servidor** (`server/permisos.js`) para dueño, recepción y mecánico. El mecánico no ve importes ni cobros y solo actúa sobre visitas asignadas (o sin responsable).
5. **Regla única de stock:** entra solo al recibir una compra; sale al colocar un repuesto del taller, al registrar un producto usado o al vender. Pedido y llegada no mueven stock.
6. **Liquidación** sobre trabajos autorizados y realizados; señas hasta lo autorizado.
7. **Cambio sobre una línea autorizada:** versión nueva; la anterior queda «reemplazada» con su autorización; si el cliente rechaza el cambio, vuelve a regir lo anterior.
8. **Fuentes Barlow servidas desde el propio servidor** (licencia OFL). No dependen de Google Fonts.
9. **Integraciones inactivas** (WhatsApp/correo automáticos, IA): se muestran con lo que necesitan y su alternativa manual. No se simulan envíos ni respuestas.
10. **Entrega con saldo configurable por taller:** dueño y recepción, solo el dueño, o no se entrega con saldo. Siempre exige confirmación y motivo; lo aplica el servidor.
11. **Demostración marcada:** los talleres de prueba llevan `demo: true`. La interfaz lo muestra, `seed --reiniciar` solo borra bases de demostración y `crear-taller` no mezcla un taller real con ellas.
12. **Detrás de un proxy** la IP del cliente se toma de `X-Forwarded-For` solo con `TALLERES_PROXY=1`.

## Decisiones de Growth Labs Talleres 0.1.0 (11/11/2026)

13. **Repositorio propio, sin la historia de la base original.** El código parte de la versión operativa 0.6.1 de la primera instalación cliente. Ningún dato, logo, contacto ni fotografía de ese cliente forma parte de este repositorio.
14. **Nombres técnicos neutrales desde el inicio:** variables `TALLERES_*`, base `talleres.db`, cabecera `X-Talleres`, cookie `glt_sesion`, claves locales `talleres-*`. Se cambiaron antes de existir instalaciones del producto, por eso no requirieron migración. A partir de ahora son contratos de compatibilidad: renombrarlos exige migración.
15. **Marca del producto separada de la marca del taller.** Sin sesión (ingreso, invitación, directorio) se muestra Growth Labs Talleres. Dentro del espacio de un taller y en sus documentos, el nombre y el logo configurados por ese taller.
16. **Demo neutral:** «Taller Modelo» y «Taller Norte», ficticios, con usuarios `@taller-modelo.test` y `@norte.test`.
