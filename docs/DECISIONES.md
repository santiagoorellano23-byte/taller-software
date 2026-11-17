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

## Identidad, planes y suscripciones (12/11/2026)

17. **Colores como datos, no como CSS.** El taller elige dos colores #rrggbb; `public/js/marca.js` calcula los tokens y garantiza contraste (texto 4,5:1, acento 3:1) en claro y oscuro. El servidor rechaza lo ilegible o lo que no sea un color. El rojo queda reservado a errores, deudas y acciones destructivas.
18. **Documentos con copia fija.** Al emitir se guarda el color y el logo; los anteriores a esta función conservan el rojo con que se emitieron.
19. **Plan ≠ permiso.** `server/planes.js` decide qué módulos y cupos tiene el taller; `server/permisos.js`, qué puede hacer cada persona. Sin el módulo de stock se consulta lo cargado pero no se registra nada nuevo; cuentas y reportes (vistas calculadas) se ocultan completos. Los límites se comprueban dentro de la transacción (`BEGIN IMMEDIATE`).
20. **Estado de la suscripción por fecha.** Se calcula en cada solicitud, así el acceso no depende de que alguien abra una pantalla; un proceso horario y `npm run vencimientos` lo guardan y registran. La gracia es una fecha cargada por Growth Labs, no una cantidad de días supuesta. Sin servicio: consulta, exportación y salida.
21. **Planes de prueba sin precio.** Los cupos de Esencial (3 usuarios, 2 GB) y Profesional (10 usuarios, 10 GB) son hipótesis del plan maestro marcadas `de_prueba`. Se cambian con una versión nueva del plan.
22. **Conciliación manual, no cobro automático.** Un pago lo registra una persona de Growth Labs con referencia y clave de idempotencia; extiende la vigencia y un pago atrasado no la acorta. No hay integración con proveedores de pago.
23. **Panel con cuentas propias.** Tabla, sesiones (8 h) y cookie (`glt_admin`, limitada a `/api/plataforma`, SameSite=Strict) separadas de los talleres. Altas solo por enlaces de un uso; nunca se imprimen claves.

## Demo operativa y Mi plan (16/11/2026)

24. **Geist Sans como tipografía del software.** Comparada con Inter y con Barlow sobre tarjeta de vehículo, formulario de recepción y presupuesto (390 y 1440 px). Un archivo variable cubre los pesos; cifras tabulares disponibles; acentos, ñ y $ correctos. Las patentes siguen en Barlow Condensed. La página comercial puede usar otra fuente.
25. **Renovar no habilita.** El taller pide la renovación o consulta un cambio de plan desde «Mi plan» (`solicitudes_servicio`); queda pendiente. Solo Growth Labs, al confirmar la acreditación y registrar el pago con la solicitud, extiende el período. Una sola solicitud pendiente por taller; se puede pedir aun suspendido.
26. **Períodos en meses calendario.** El fin es el día anterior al mismo día del mes siguiente (17/11 → 16/12); si ese día no existe, el último del mes. Renovar antes de vencer empieza al día siguiente del vencimiento y conserva los días pagados. Solo «1 mes» está habilitado (`PERIODOS_MESES`); otros períodos se agregan cuando Growth Labs los apruebe, sin descuentos inventados. No hay renovación automática.
27. **Datos de transferencia por configuración.** `TALLERES_TRANSFERENCIA` (texto aprobado por Growth Labs). Sin ese dato, «Mi plan» no muestra ninguna cuenta. Sin precio cargado en el plan, el importe figura «A confirmar» y se pide la renovación sin pagar.
28. **Permiso propio para el servicio.** `servicio.gestionar` (dueño). Mecánico y recepción no ven «Mi plan» ni reciben el aviso de vencimiento; el servidor lo comprueba.

## Ajustes «Consola Grafito» (17/11/2026)

29. **Ajustes adopta la propuesta A dentro de la estructura actual.** El prototipo reemplazaba la barra principal y agregaba «Volver al taller»; eso no se trasladó: la isla y el lateral siguen igual y el índice de Ajustes vive dentro del área de contenido. Las once áreas conservan las rutas anteriores (`#/ajustes/taller`, `/catalogos`, `/integraciones`, `/datos`…) y suman `presupuestos`, `horario` y `publica`. Cada área guarda solo sus campos con el mismo `PUT /api/taller`, que ya era parcial.
30. **Lo que el prototipo simulaba no se simula.** Renovar sigue siendo una solicitud pendiente, las conexiones siguen inactivas, las descargas son las reales y el registro filtra en pantalla las últimas 300 acciones del servidor. La matriz de permisos del prototipo no se copió: se muestran los textos de cada perfil que ya usaba el producto.

## Demostración sin contraseña (17/11/2026)

31. **Las demos entran solas como dueño.** `TALLERES_DEMO_SIN_INGRESO=1` (demo local y demo de Vercel) habilita `POST /api/sesion/demo`, que crea una sesión normal del dueño del primer taller. El servidor se niega si la base tiene algún taller sin `demo: true`, así que la variable puesta por error en una instalación real no abre ninguna cuenta. «Salir» muestra la pantalla de ingreso en esa pestaña para probar recepción o mecánico. Queda registrado en el registro de acciones.

## Oscuro grafito en toda la aplicación (17/11/2026)

32. **Un solo oscuro: el grafito de Ajustes.** Reemplaza los grises azulados anteriores en `tema.css`; Ajustes deja de tener valores propios y toma los globales, así no hay salto al entrar. Solo cambian colores: la isla, la navegación y las demás pantallas conservan forma y comportamiento. Los colores de estado no se tocaron. El borde de tarjetas (`#383c43`) queda entre el divisor y el borde de controles de la referencia, para que una tarjeta se separe del fondo. `marca.js` mide los contrastes de la marca de cada taller contra el nuevo fondo y la nueva superficie (la prueba de identidad comprueba ambos); los documentos emitidos conservan sus colores.
33. **Índice de Ajustes al costado solo con lugar.** Con el lateral global, a 1024 px el índice dejaba los formularios en ~550 px. Desde ahora queda al costado cuando el contenedor mide 960 px o más; por debajo se usa la lista de áreas y la vista dedicada, como en el celular.

## Isla móvil C (17/11/2026)

34. **Deslizador invertido con Recibir en lengüeta.** Reemplaza la isla anterior solo en celular y tablet (hasta 1023 px). Estilos propios bajo `.isla`, sin heredar las reglas de `.tabbar`. Más sigue siendo la pantalla real `#/mas` (con sus funciones según permisos), así que es un destino y no un panel: no lleva `aria-expanded`. Diferencias con el HTML de referencia, todas por el producto: tipografía Geist en vez de Inter; el azul de Recibir es el color de acción del taller (el del producto es #2e3bff, la referencia usa #4652FF) porque la identidad de cada taller manda en botones y navegación; el foco sobre el indicador claro usa el color de acción, porque el lila de la referencia no se distingue sobre el claro; en modo claro se invierten los mismos tokens. Las pruebas fueron en navegador emulado, no en un teléfono físico.
