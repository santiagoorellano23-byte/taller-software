# Growth Labs Talleres

Versión 0.1.0. Software de gestión para talleres mecánicos, multi-taller, con la identidad de cada taller. Recepción de vehículos, órdenes, revisión, presupuesto y autorización versionados, repuestos, trabajo, control, cobros, entrega e historial por patente.

El código parte de la base operativa (versión 0.6.1) desarrollada para la primera instalación cliente, sin sus datos, su identidad ni su historial de cambios.

## Requisitos y demostración

Node.js 24 o posterior, con SQLite integrado. Sin dependencias externas ni compilación.

```sh
npm run seed
npm start
```

Abrir http://127.0.0.1:3000. La demostración usa exclusivamente datos ficticios («Taller Modelo» y «Taller Norte»). Los usuarios de prueba están en `scripts/seed.js` y nunca se incluyen en el paquete de despliegue. No ejecutar seed sobre una instalación real.

## Verificación

```sh
npm test
```

98 pruebas automáticas sobre la API real con base temporal: permisos, aislamiento por taller, identidad, planes y suscripciones, panel central, recepción, idempotencia, presupuestos, cobros, stock, archivos, migraciones y respaldo/restauración.

## Funciones

- Recepción guiada de siete pasos con fotos de ingreso, borrador temporal y confirmación del servidor.
- Hoy organizado en Para hacer, Bloqueados y Listos para retirar.
- Órdenes con Resumen, Revisión, Trabajos, Repuestos e Historial.
- Agenda, clientes, compras, proveedores, stock, mostrador, caja, cuentas, reportes, documentos, biblioteca y configuración.
- Perfiles y permisos comprobados en el servidor. Datos separados por taller.
- Nombre, logo, colores y página pública configurables por taller.
- Planes con módulos y cupos comprobados en el servidor; suscripción con vencimiento y gracia por fecha.
- No es un sistema fiscal: ARCA y Libro IVA están excluidos. Mensajería automática e IA no están activas; no se simulan envíos.

Lo que falta para ofrecerlo como servicio pago está en `docs/HOJA-DE-RUTA.md`.

## Instalación

Definir `TALLERES_DATOS` con una ruta absoluta fuera del código y de cualquier carpeta que el despliegue reemplace. Configurar `NODE_ENV=production`, `TALLERES_SEGURO=1` y `TALLERES_URL_PUBLICA` con la URL HTTPS. Usar `TALLERES_PROXY=1` solo detrás del proxy del alojamiento.

Las invitaciones y recuperaciones son enlaces personales de un uso; el responsable los entrega por un medio seguro. No publicar esos enlaces ni bases o archivos privados.

## Panel de Growth Labs

`/plataforma` es el panel central: buscar talleres, dar de alta un taller con la invitación de su responsable (se puede retomar si queda incompleta), asignar plan y vigencia, registrar pagos confirmados a mano y revisar el registro de acciones. Usa cuentas propias, separadas de las de los talleres.

```sh
npm run crear-admin -- --email persona@ejemplo.com --nombre "Nombre"
```

Imprime un enlace de un uso (24 h) para crear la contraseña. `npm run crear-taller` sigue disponible por consola.

**Suscripciones.** El acceso de cada taller se decide por fecha en cada solicitud: en prueba o activa, uso completo; vencida, uso completo hasta la fecha de gracia que se cargue (sin gracia, nada); suspendida o cancelada, solo consulta, exportación y salida. Nunca se borran datos. El servidor guarda y registra los cambios de estado al arrancar y cada hora; si el alojamiento reinicia el proceso seguido, programar además `npm run vencimientos` una vez por día en su cron.

**Planes.** Los dos planes cargados (Esencial y Profesional) son **configuración de prueba**: cupos tomados como hipótesis y sin precio. Para cambiarlos se agrega una versión nueva en la tabla `planes`; los talleres conservan la versión que tienen hasta que se les asigne otra. El cobro es por conciliación manual: no hay integración de pagos.

## Respaldos y actualizaciones

```sh
npm run backup
npm run restore -- /ruta/respaldo --destino /ruta/nueva
python scripts/empaquetar-hostinger.py /ruta/salida
```

Antes de actualizar: generar un respaldo, comprobar su restauración aislada y conservar las variables de entorno. El paquete de despliegue excluye pruebas, datos ficticios y credenciales; arranca con `servidor.cjs`. Las migraciones son aditivas. No reemplazar la carpeta de datos.

## Estructura

`server/` reglas, permisos, rutas y migraciones; `public/` interfaz y recursos locales; `scripts/` utilidades; `test/` pruebas. Reglas para agentes en `AGENTS.md`; producto en `PRODUCT.md`; sistema visual en `DESIGN.md`; decisiones en `docs/DECISIONES.md`.

Los recursos de terceros conservan sus licencias y procedencia en `public/RECURSOS-REDISENO.json` y los archivos de licencia correspondientes. Las marcas de vehículos identifican vehículos y no implican afiliación.
